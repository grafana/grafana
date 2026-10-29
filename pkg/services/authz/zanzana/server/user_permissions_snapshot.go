package server

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
)

const (
	permissionSnapshotConcurrency = 8
	permissionSnapshotMaxTuples   = 100000
	permissionSnapshotFolderBatch = 128
	permissionSnapshotMaxDepth    = 1000
)

var permissionSnapshotModel = sync.OnceValues(func() (*openfgav1.AuthorizationModel, error) {
	return schema.TransformModulesToModel(schema.SchemaModules)
})

type permissionListResult struct {
	Entry common.ActionListEntry
	List  *authzv1.ListResponse
}

// listUserPermissions resolves each principal once over the datastore interface,
// then evaluates the complete request graph with OpenFGA. Keeping evaluation local
// avoids repeating remote membership and grant reads for every legacy action.
func (s *Server) listUserPermissions(ctx context.Context, req *authzv1.GetUserPermissionsRequest) ([]permissionListResult, error) {
	// Cancel remote streams even when a tuple or depth limit ends iteration early.
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	store, err := s.getStoreInfo(ctx, req.GetNamespace())
	if err != nil {
		return nil, err
	}
	model, err := s.store.ReadAuthorizationModel(ctx, store.ID, store.ModelID)
	if err != nil {
		return nil, fmt.Errorf("read permission snapshot model: %w", err)
	}
	expected, err := permissionSnapshotModel()
	if err != nil {
		return nil, err
	}
	// Closure below relies on flat teams/roles and folder-only inheritance.
	// A different model requires reviewing the graph discovery rules.
	if model == nil || !schema.EqualModels(model, expected) {
		return nil, status.Error(codes.FailedPrecondition, "authorization model does not support permission snapshots")
	}

	tuples := &permissionSnapshotTuples{keys: make(map[permissionSnapshotTupleKey]*openfgav1.TupleKey)}
	principals := map[string]struct{}{req.GetSubject(): {}}
	for _, team := range req.GetTeams() {
		if team != "" {
			principals[common.NewTypedIdent(common.TypeTeam, team)+"#"+common.RelationTeamMember] = struct{}{}
		}
	}
	if err := s.readPermissionPrincipals(ctx, store.ID, principals, tuples); err != nil {
		return nil, err
	}

	// Membership supplied by the request needs no discovery call. Stored admin or
	// member edges arrive with the user's grants and preserve callers that supply
	// only contextual groups rather than an exhaustive membership list.
	storedTeams := make(map[string]struct{})
	for _, tk := range tuples.values() {
		if tk.GetUser() == req.GetSubject() && strings.HasPrefix(tk.GetObject(), common.TypeTeamPrefix) &&
			(tk.GetRelation() == common.RelationTeamMember || tk.GetRelation() == common.RelationTeamAdmin) {
			principal := tk.GetObject() + "#" + common.RelationTeamMember
			if _, read := principals[principal]; !read {
				storedTeams[principal] = struct{}{}
			}
		}
	}
	if err := s.readPermissionPrincipals(ctx, store.ID, storedTeams, tuples); err != nil {
		return nil, err
	}

	roles := make(map[string]struct{})
	for _, tk := range tuples.values() {
		if strings.HasPrefix(tk.GetObject(), common.TypeRole+":") && tk.GetRelation() == common.RelationAssignee {
			roles[tk.GetObject()+"#"+common.RelationAssignee] = struct{}{}
		}
	}
	if err := s.readPermissionPrincipals(ctx, store.ID, roles, tuples); err != nil {
		return nil, err
	}
	if err := s.readPermissionDescendants(ctx, store.ID, tuples); err != nil {
		return nil, err
	}

	localStore, err := newPermissionSnapshotStore(ctx, store.ID, model, tuples.values())
	if err != nil {
		return nil, err
	}

	// Every request owns its model/tuple store and evaluator. Shared evaluation
	// caches must not reuse decisions made against a different request's graph.
	cfg := s.cfg
	cfg.CacheSettings.CheckCacheLimit = 1
	cfg.CacheSettings.CheckQueryCacheEnabled = false
	cfg.CacheSettings.CheckIteratorCacheEnabled = false
	cfg.CacheSettings.ListObjectsIteratorCacheEnabled = false
	cfg.CacheSettings.SharedIteratorEnabled = false
	cfg.CacheSettings.CacheControllerEnabled = false
	cfg.OpenFgaServerSettings.AuthorizationModelCacheSize = 1
	cfg.OpenFgaServerSettings.TypesystemCacheSize = 1
	openfga, err := NewOpenFGAServer(cfg, localStore)
	if err != nil {
		localStore.Close()
		return nil, err
	}
	defer openfga.Close()
	channel := &inprocgrpc.Channel{}
	openfgav1.RegisterOpenFGAServiceServer(channel, openfga)
	local := &Server{
		openFGAClient: openfgav1.NewOpenFGAServiceClient(channel),
		store:         localStore,
		cfg:           cfg,
		stores:        map[string]zanzana.StoreInfo{req.GetNamespace(): *store},
		logger:        s.logger,
		tracer:        s.tracer,
	}

	type listKey struct{ group, resource, subresource, verb string }
	resolved := make(map[listKey]*authzv1.ListResponse)
	results := make([]permissionListResult, 0, len(common.SupportedActions()))
	for _, entry := range common.SupportedActions() {
		key := listKey{entry.Group, entry.Resource, entry.Subresource, entry.Verb}
		response, found := resolved[key]
		if !found {
			response, err = local.list(ctx, &authzv1.ListRequest{
				Namespace: req.GetNamespace(), Subject: req.GetSubject(), Teams: req.GetTeams(),
				Group: entry.Group, Resource: entry.Resource, Subresource: entry.Subresource, Verb: entry.Verb,
			})
			if err != nil {
				return nil, fmt.Errorf("evaluate permission snapshot action %s: %w", entry.Action, err)
			}
			resolved[key] = response
		}
		results = append(results, permissionListResult{Entry: entry, List: response})
	}
	return results, nil
}

type permissionSnapshotTupleKey struct{ user, relation, object string }

type permissionSnapshotTuples struct {
	mu   sync.Mutex
	keys map[permissionSnapshotTupleKey]*openfgav1.TupleKey
}

func (t *permissionSnapshotTuples) add(tk *openfgav1.TupleKey) error {
	if tk == nil {
		return errors.New("datastore returned an empty permission tuple")
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	key := permissionSnapshotTupleKey{tk.GetUser(), tk.GetRelation(), tk.GetObject()}
	if _, exists := t.keys[key]; exists {
		return nil
	}
	// Reject oversized graphs instead of returning an incomplete permission set.
	if len(t.keys) >= permissionSnapshotMaxTuples {
		return status.Error(codes.ResourceExhausted, "permission snapshot tuple limit exceeded")
	}
	t.keys[key] = tk
	return nil
}

func (t *permissionSnapshotTuples) values() []*openfgav1.TupleKey {
	t.mu.Lock()
	defer t.mu.Unlock()
	keys := make([]*openfgav1.TupleKey, 0, len(t.keys))
	for _, key := range t.keys {
		keys = append(keys, key)
	}
	return keys
}

func (s *Server) readPermissionPrincipals(ctx context.Context, storeID string, principals map[string]struct{}, tuples *permissionSnapshotTuples) error {
	group, ctx := errgroup.WithContext(ctx)
	group.SetLimit(permissionSnapshotConcurrency)
	for principal := range principals {
		group.Go(func() error {
			if err := ctx.Err(); err != nil {
				return err
			}
			iterator, err := s.store.Read(ctx, storeID, storage.ReadFilter{User: principal}, storage.ReadOptions{})
			if err != nil {
				return fmt.Errorf("read permission principal: %w", err)
			}
			defer iterator.Stop()
			return collectPermissionTuples(ctx, iterator, tuples.add)
		})
	}
	return group.Wait()
}

func collectPermissionTuples(ctx context.Context, iterator storage.TupleIterator, add func(*openfgav1.TupleKey) error) error {
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		tuple, err := iterator.Next(ctx)
		if errors.Is(err, storage.ErrIteratorDone) {
			return nil
		}
		if err != nil {
			return err
		}
		if err := add(tuple.GetKey()); err != nil {
			return err
		}
	}
}

func (s *Server) readPermissionDescendants(ctx context.Context, storeID string, tuples *permissionSnapshotTuples) error {
	seen := make(map[string]struct{})
	var frontier []string
	for _, tk := range tuples.values() {
		if strings.HasPrefix(tk.GetObject(), common.TypeFolderPrefix) {
			if _, found := seen[tk.GetObject()]; !found {
				seen[tk.GetObject()] = struct{}{}
				frontier = append(frontier, tk.GetObject())
			}
		}
	}
	for depth := 0; len(frontier) > 0; depth++ {
		if depth >= permissionSnapshotMaxDepth {
			return status.Error(codes.ResourceExhausted, "permission snapshot folder depth exceeded")
		}
		var next []string
		for batch := range slices.Chunk(frontier, permissionSnapshotFolderBatch) {
			filter := storage.ReadStartingWithUserFilter{ObjectType: common.TypeFolder, Relation: common.RelationParent}
			for _, folder := range batch {
				filter.UserFilter = append(filter.UserFilter, &openfgav1.ObjectRelation{Object: folder})
			}
			iterator, err := s.store.ReadStartingWithUser(ctx, storeID, filter, storage.ReadStartingWithUserOptions{})
			if err != nil {
				return fmt.Errorf("read permission descendants: %w", err)
			}
			err = collectPermissionTuples(ctx, iterator, func(tk *openfgav1.TupleKey) error {
				if err := tuples.add(tk); err != nil {
					return err
				}
				if _, found := seen[tk.GetObject()]; !found {
					seen[tk.GetObject()] = struct{}{}
					next = append(next, tk.GetObject())
				}
				return nil
			})
			iterator.Stop()
			if err != nil {
				return err
			}
		}
		frontier = next
	}
	return nil
}
