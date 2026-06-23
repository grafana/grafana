package server

import (
	"context"
	"errors"
	"sync"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"golang.org/x/sync/errgroup"
	"google.golang.org/protobuf/types/known/wrapperspb"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

const (
	maxRoleNestDepth       = 16
	maxGrantReadConcurrent = 8
)

// grantObjectPrefixes are the fixed OpenFGA object-type prefixes scanned for permission grants.
var grantObjectPrefixes = []string{
	common.TypeGroupResoucePrefix,
	common.TypeResourcePrefix,
	common.TypeFolderPrefix,
	common.TypeTeamPrefix,
}

func (s *Server) queryListUserPermissions(ctx context.Context, store *zanzana.StoreInfo, req *authzextv1.ListUserPermissionsQuery) (*authzextv1.QueryResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.queryListUserPermissions")
	defer span.End()

	if req.GetSubject() == "" {
		return nil, errors.New("subject cannot be empty")
	}

	grants, err := s.listUserPermissions(ctx, store, req)
	if err != nil {
		return nil, err
	}

	return &authzextv1.QueryResponse{
		Result: &authzextv1.QueryResponse_UserPermissions{
			UserPermissions: &authzextv1.ListUserPermissionsResult{
				Grants: grants,
			},
		},
	}, nil
}

func (s *Server) listUserPermissions(ctx context.Context, store *zanzana.StoreInfo, req *authzextv1.ListUserPermissionsQuery) ([]*authzextv1.TupleKey, error) {
	subjects, err := s.resolveGrantSubjects(ctx, store, req.GetSubject(), req.GetTeams())
	if err != nil {
		return nil, err
	}

	seen := make(map[string]struct{})
	var (
		mu     sync.Mutex
		grants []*authzextv1.TupleKey
	)

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(maxGrantReadConcurrent)

	for subject := range subjects {
		subject := subject
		for _, objectPrefix := range grantObjectPrefixes {
			objectPrefix := objectPrefix
			g.Go(func() error {
				tuples, err := s.readGrantTuples(gctx, store, subject, objectPrefix)
				if err != nil {
					return err
				}
				mu.Lock()
				for _, t := range tuples {
					if !isGrantTuple(t) {
						continue
					}
					key := zanzana.TupleStringWithoutCondition(t)
					if _, dup := seen[key]; dup {
						continue
					}
					seen[key] = struct{}{}
					grants = append(grants, common.ToAuthzExtTupleKey(t))
				}
				mu.Unlock()
				return nil
			})
		}
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return grants, nil
}

func (s *Server) resolveGrantSubjects(ctx context.Context, store *zanzana.StoreInfo, subject string, teams []string) (map[string]struct{}, error) {
	subjects := map[string]struct{}{
		subject: {},
	}
	for _, team := range teams {
		if team == "" {
			continue
		}
		subjects[common.NewTupleEntry(common.TypeTeam, team, common.RelationTeamMember)] = struct{}{}
	}

	roleAssignees, err := s.collectRoleAssignees(ctx, store, subjects)
	if err != nil {
		return nil, err
	}
	for role := range roleAssignees {
		subjects[role] = struct{}{}
	}

	return subjects, nil
}

func (s *Server) collectRoleAssignees(ctx context.Context, store *zanzana.StoreInfo, directSubjects map[string]struct{}) (map[string]struct{}, error) {
	roleAssignees := make(map[string]struct{})
	visitedRoles := make(map[string]struct{})

	queue := make([]string, 0, len(directSubjects))
	for subject := range directSubjects {
		queue = append(queue, subject)
	}

	for depth := 0; len(queue) > 0 && depth < maxRoleNestDepth; depth++ {
		nextQueue := make([]string, 0)
		for _, subject := range queue {
			roles, err := s.readRoleBindings(ctx, store, subject)
			if err != nil {
				return nil, err
			}
			for _, roleUID := range roles {
				roleAssignee := common.NewTupleEntry(common.TypeRole, roleUID, common.RelationAssignee)
				if _, seen := visitedRoles[roleUID]; seen {
					continue
				}
				visitedRoles[roleUID] = struct{}{}
				roleAssignees[roleAssignee] = struct{}{}
				nextQueue = append(nextQueue, roleAssignee)
			}
		}
		queue = nextQueue
	}

	return roleAssignees, nil
}

func (s *Server) readRoleBindings(ctx context.Context, store *zanzana.StoreInfo, subject string) ([]string, error) {
	tuples, err := s.readTuples(ctx, store, &openfgav1.ReadRequestTupleKey{
		User:     subject,
		Relation: common.RelationAssignee,
		Object:   common.NewTupleEntry(common.TypeRole, "", ""),
	})
	if err != nil {
		return nil, err
	}

	roles := make([]string, 0, len(tuples))
	for _, t := range tuples {
		_, roleUID, _ := common.SplitTupleObject(t.GetObject())
		if roleUID == "" {
			continue
		}
		roles = append(roles, roleUID)
	}
	return roles, nil
}

func (s *Server) readGrantTuples(ctx context.Context, store *zanzana.StoreInfo, subject, objectPrefix string) ([]*openfgav1.TupleKey, error) {
	return s.readTuples(ctx, store, &openfgav1.ReadRequestTupleKey{
		User:   subject,
		Object: objectPrefix,
	})
}

func (s *Server) readTuples(ctx context.Context, store *zanzana.StoreInfo, filter *openfgav1.ReadRequestTupleKey) ([]*openfgav1.TupleKey, error) {
	pageSize := int32(s.cfg.ReadPageSize)
	if pageSize <= 0 {
		pageSize = 100
	}

	var (
		out               []*openfgav1.TupleKey
		continuationToken string
	)

	for {
		req := &openfgav1.ReadRequest{
			StoreId:           store.ID,
			PageSize:          wrapperspb.Int32(pageSize),
			ContinuationToken: continuationToken,
			TupleKey:          filter,
		}

		res, err := s.openFGAClient.Read(ctx, req)
		if err != nil {
			return nil, err
		}

		for _, t := range res.GetTuples() {
			out = append(out, t.GetKey())
		}

		continuationToken = res.GetContinuationToken()
		if continuationToken == "" {
			break
		}
	}

	return out, nil
}

// isGrantTuple reports whether a tuple represents a permission grant rather than a
// structural relation. The decision is object-type aware because some relation names
// are overloaded: "admin" is team membership on team objects but an action-set grant
// on folder/resource/group_resource objects (RelationTeamAdmin == RelationSetAdmin).
func isGrantTuple(t *openfgav1.TupleKey) bool {
	if t == nil {
		return false
	}

	objectType, _, _ := common.SplitTupleObject(t.GetObject())
	relation := t.GetRelation()

	// Role assignment tuples (subject -> role) are never grants.
	if relation == common.RelationAssignee {
		return false
	}

	switch objectType {
	case common.TypeRole:
		return false
	case common.TypeTeam:
		// member/admin are team-membership relations, not permission grants.
		if relation == common.RelationTeamMember || relation == common.RelationTeamAdmin {
			return false
		}
	case common.TypeFolder:
		// parent is the folder hierarchy relation, not a permission grant.
		if relation == common.RelationParent {
			return false
		}
	}

	return true
}
