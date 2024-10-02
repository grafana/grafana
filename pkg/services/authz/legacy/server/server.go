package server

import (
	"context"

	"github.com/grafana/authlib/claims"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacy/store"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var _ openfgav1.OpenFGAServiceServer = (*Server)(nil)

func NewServer(sql legacysql.LegacyDatabaseProvider, logger log.Logger) *Server {
	return &Server{
		store:           store.NewStore(sql),
		logger:          logger,
		identityCache:   newCache[store.Identity](),
		permissionCache: newCache[[]accesscontrol.Permission](),
	}
}

type Server struct {
	openfgav1.UnimplementedOpenFGAServiceServer
	logger          log.Logger
	store           store.LegacyStore
	identityCache   *cache[store.Identity]
	permissionCache *cache[[]accesscontrol.Permission]
}

// FIXME: error handling
// FIXME: action sets
// FIXME: shared with me
func (s *Server) Check(ctx context.Context, r *openfgav1.CheckRequest) (*openfgav1.CheckResponse, error) {
	if r.TupleKey == nil {
		return nil, status.Error(codes.InvalidArgument, "missing required tuple key")
	}

	ns, err := claims.ParseNamespace(r.StoreId)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	s.logger.Debug("check req", "id", r.TupleKey.User, "relation", r.TupleKey.Relation, "object", r.TupleKey.Object)

	list, err := s.listPermissions(ctx, ns, r.TupleKey.User, r.TupleKey.Relation)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	// If we did not provide an object for check we just want to check precense of action.
	var eval accesscontrol.Evaluator
	if r.TupleKey.Object == "" {
		eval = accesscontrol.EvalPermission(r.TupleKey.Relation)
	} else {
		scopes := []string{r.TupleKey.Object}

		// This is not entirely correct. In openfga contextuals are things that would be
		// counted when doing evaluation but we are using it here to be able to provide other things
		// we want to check access for e.g. folder for object.
		if r.ContextualTuples != nil {
			for _, key := range r.ContextualTuples.TupleKeys {
				scopes = append(scopes, key.Object)
			}
		}
		eval = accesscontrol.EvalPermission(r.TupleKey.Relation, scopes...)
	}

	if !eval.Evaluate(accesscontrol.GroupScopesByActionContext(ctx, list.Items)) {
		return &openfgav1.CheckResponse{Allowed: false}, nil
	}

	return &openfgav1.CheckResponse{Allowed: true}, nil
}

func (s *Server) Read(ctx context.Context, r *openfgav1.ReadRequest) (*openfgav1.ReadResponse, error) {
	if r.TupleKey == nil {
		return nil, status.Error(codes.InvalidArgument, "tuple key is required for read request")
	}

	ns, err := claims.ParseNamespace(r.StoreId)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	list, err := s.listPermissions(ctx, ns, r.TupleKey.User, r.TupleKey.Relation)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	tuples := make([]*openfgav1.Tuple, 0, len(list.Items))
	for _, p := range list.Items {
		tuples = append(tuples, &openfgav1.Tuple{
			Key: &openfgav1.TupleKey{
				User:     r.TupleKey.User,
				Relation: r.TupleKey.Relation,
				Object:   p.Scope,
			},
		})
	}

	return &openfgav1.ReadResponse{Tuples: tuples}, nil
}

func (s *Server) ListObjects(ctx context.Context, r *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	ns, err := claims.ParseNamespace(r.StoreId)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	list, err := s.listPermissions(ctx, ns, r.User, r.Relation)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	objects := make([]string, 0, len(list.Items))
	for _, p := range list.Items {
		objects = append(objects, p.Scope)
	}

	return &openfgav1.ListObjectsResponse{Objects: objects}, nil
}

func (s *Server) getIdentity(ctx context.Context, ns claims.NamespaceInfo, id string) (*store.Identity, error) {
	ident, ok := s.identityCache.Get(identityCacheKey(ns, id))
	if ok {
		s.logger.Debug("got identitiy from cache", "namespace", ns.Value, "id", id, "identity", ident)
		return &ident, nil
	}

	res, err := s.store.GetIdentity(ctx, ns, store.GetIdentityQuery{
		ID: id,
	})

	if err != nil {
		s.logger.Error("failed to resolve identity", "err", err, "namespace", ns.Value, "id", id)
		return nil, err
	}

	s.logger.Debug("got identitiy from store", "namespace", ns.Value, "id", id, "identity", ident)
	s.identityCache.Set(identityCacheKey(ns, id), res.Identity)
	return &res.Identity, nil
}

func (s *Server) listPermissions(ctx context.Context, ns claims.NamespaceInfo, id, action string) (*store.ListPermissionsResult, error) {
	ident, err := s.getIdentity(ctx, ns, id)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	permissions, ok := s.permissionCache.Get(permissionCacheKey(ns, id, action))
	if ok {
		s.logger.Debug("got permissions from cache", "namespace", ns.Value, "id", id, "action", action)
		return &store.ListPermissionsResult{Items: permissions}, nil
	}

	res, err := s.store.ListPermissions(ctx, ns, store.ListPermissionsQuery{
		UserID: ident.UserID,
		Roles:  ident.Roles,
		Teams:  ident.Teams,
		Action: action,
	})

	if err != nil {
		s.logger.Error("failed to list permissions", "err", err, "namespace", ns.Value, "id", id, "action", action)
		return nil, err
	}

	s.logger.Debug("got permissions from store", "namespace", ns.Value, "id", id, "action", action)
	s.permissionCache.Set(permissionCacheKey(ns, id, action), res.Items)
	return res, nil
}

func identityCacheKey(ns claims.NamespaceInfo, id string) string {
	return ns.Value + id
}

func permissionCacheKey(ns claims.NamespaceInfo, id, action string) string {
	return ns.Value + id + action
}
