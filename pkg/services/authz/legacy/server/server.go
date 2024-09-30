package server

import (
	"context"

	"github.com/grafana/authlib/claims"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacy/store"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var _ openfgav1.OpenFGAServiceServer = (*Server)(nil)

func NewServer(sql legacysql.LegacyDatabaseProvider) *Server {
	return &Server{
		store: store.NewStore(sql),
	}
}

type Server struct {
	openfgav1.UnimplementedOpenFGAServiceServer
	store store.LegacyStore
}

// FIXME: error handling
// FIXME: action sets
// FIXME: shared with me
func (s *Server) Check(ctx context.Context, r *openfgav1.CheckRequest) (*openfgav1.CheckResponse, error) {
	ns, err := claims.ParseNamespace(r.StoreId)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	// FIXME: cache
	res, err := s.store.GetIdentity(ctx, ns, store.GetIdentityQuery{
		ID: r.TupleKey.User,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	// FIXME: cache
	listRes, err := s.store.ListPermissions(ctx, ns, store.ListPermissionsQuery{
		UserID: res.Identity.UserID,
		Roles:  res.Identity.Roles,
		Teams:  res.Identity.Teams,
		Action: r.TupleKey.Relation,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	// If we did not provide an object for check we just want to check precense of action.
	var eval accesscontrol.Evaluator
	if r.TupleKey.Object == "" {
		eval = accesscontrol.EvalPermission(r.TupleKey.Relation)
	} else {
		scopes := []string{r.TupleKey.Object}

		// This is not entierly correct. In openfga contextuals are things that would be
		// counted when doing evaluation but we are using it here to be able to provide other things
		// we want to check access for e.g. folder for object.
		if r.ContextualTuples != nil {
			for _, key := range r.ContextualTuples.TupleKeys {
				scopes = append(scopes, key.Object)
			}
		}
		eval = accesscontrol.EvalPermission(r.TupleKey.Relation, scopes...)
	}

	if !eval.Evaluate(accesscontrol.GroupScopesByActionContext(ctx, listRes.Items)) {
		return &openfgav1.CheckResponse{Allowed: false}, nil
	}

	return &openfgav1.CheckResponse{Allowed: true}, nil
}

func (s *Server) Read(ctx context.Context, r *openfgav1.ReadRequest) (*openfgav1.ReadResponse, error) {
	ns, err := claims.ParseNamespace(r.StoreId)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	if r.TupleKey == nil {
		return nil, status.Error(codes.Unimplemented, "tuple key is required for read request")
	}

	// FIXME: cache
	res, err := s.store.GetIdentity(ctx, ns, store.GetIdentityQuery{
		ID: r.TupleKey.User,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	// FIXME: cache
	listRes, err := s.store.ListPermissions(ctx, ns, store.ListPermissionsQuery{
		UserID: res.Identity.UserID,
		Roles:  res.Identity.Roles,
		Teams:  res.Identity.Teams,
		Action: r.TupleKey.Relation,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	tuples := make([]*openfgav1.Tuple, 0, len(listRes.Items))
	for _, p := range listRes.Items {
		tuples = append(tuples, &openfgav1.Tuple{
			Key: &openfgav1.TupleKey{
				User:     r.TupleKey.User,
				Relation: r.TupleKey.Relation,
				Object:   p.Scope,
			},
		})
	}

	// FIXME: pagination
	return &openfgav1.ReadResponse{Tuples: tuples}, nil

}

func (s *Server) ListObjects(ctx context.Context, r *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	ns, err := claims.ParseNamespace(r.StoreId)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	// FIXME: cache
	res, err := s.store.GetIdentity(ctx, ns, store.GetIdentityQuery{
		ID: r.User,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	// FIXME: cache
	listRes, err := s.store.ListPermissions(ctx, ns, store.ListPermissionsQuery{
		UserID: res.Identity.UserID,
		Roles:  res.Identity.Roles,
		Teams:  res.Identity.Teams,
		Action: r.Relation,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	objects := make([]string, 0, len(listRes.Items))
	for _, p := range listRes.Items {
		objects = append(objects, p.Scope)
	}

	return &openfgav1.ListObjectsResponse{Objects: objects}, nil
}

func (s *Server) CreateStore(context.Context, *openfgav1.CreateStoreRequest) (*openfgav1.CreateStoreResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) DeleteStore(context.Context, *openfgav1.DeleteStoreRequest) (*openfgav1.DeleteStoreResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) Expand(context.Context, *openfgav1.ExpandRequest) (*openfgav1.ExpandResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) GetStore(context.Context, *openfgav1.GetStoreRequest) (*openfgav1.GetStoreResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) ListStores(context.Context, *openfgav1.ListStoresRequest) (*openfgav1.ListStoresResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) ListUsers(context.Context, *openfgav1.ListUsersRequest) (*openfgav1.ListUsersResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) ReadAssertions(context.Context, *openfgav1.ReadAssertionsRequest) (*openfgav1.ReadAssertionsResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) ReadAuthorizationModel(context.Context, *openfgav1.ReadAuthorizationModelRequest) (*openfgav1.ReadAuthorizationModelResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) ReadAuthorizationModels(context.Context, *openfgav1.ReadAuthorizationModelsRequest) (*openfgav1.ReadAuthorizationModelsResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) ReadChanges(context.Context, *openfgav1.ReadChangesRequest) (*openfgav1.ReadChangesResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) StreamedListObjects(*openfgav1.StreamedListObjectsRequest, openfgav1.OpenFGAService_StreamedListObjectsServer) error {
	return status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) UpdateStore(context.Context, *openfgav1.UpdateStoreRequest) (*openfgav1.UpdateStoreResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) Write(context.Context, *openfgav1.WriteRequest) (*openfgav1.WriteResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) WriteAssertions(context.Context, *openfgav1.WriteAssertionsRequest) (*openfgav1.WriteAssertionsResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) WriteAuthorizationModel(context.Context, *openfgav1.WriteAuthorizationModelRequest) (*openfgav1.WriteAuthorizationModelResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) mustEmbedUnimplementedOpenFGAServiceServer() {}
