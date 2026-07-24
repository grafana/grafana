package server

import (
	"context"
	"errors"
	"fmt"
	"sync"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"golang.org/x/sync/errgroup"
	"google.golang.org/protobuf/types/known/wrapperspb"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

const (
	maxRoleNestDepth       = 16
	maxGrantReadConcurrent = 8
)

// grantObjectPrefixes are the fixed OpenFGA object-type prefixes scanned when a
// GetGrants request has no resource-type filter.
var grantObjectPrefixes = []string{
	common.TypeGroupResoucePrefix,
	common.TypeResourcePrefix,
	common.TypeFolderPrefix,
	common.TypeTeamPrefix,
	common.TypeUser + ":",
	common.TypeServiceAccount + ":",
}

func (s *Server) queryGetGrants(ctx context.Context, store *zanzana.StoreInfo, req *authzextv1.GetGrantsQuery) (*authzextv1.QueryResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.queryGetGrants")
	defer span.End()

	if req.GetSubject() == "" {
		return nil, errors.New("subject cannot be empty")
	}

	tuples, err := s.readDirectGrantTuples(ctx, store, req.GetSubject(), req.GetTeams(), req.GetTypes())
	if err != nil {
		return nil, err
	}

	return &authzextv1.QueryResponse{
		Result: &authzextv1.QueryResponse_Grants{
			Grants: common.NormalizeGrantTuples(tuples, req.GetTypes()),
		},
	}, nil
}

func (s *Server) readDirectGrantTuples(ctx context.Context, store *zanzana.StoreInfo, subject string, teams []string, types []*authzextv1.ResourceType) ([]*authzextv1.TupleKey, error) {
	subjects, err := s.resolveGrantSubjects(ctx, store, subject, teams)
	if err != nil {
		return nil, err
	}

	var (
		mu     sync.Mutex
		grants []*authzextv1.TupleKey
	)

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(maxGrantReadConcurrent)

	for subject := range subjects {
		subject := subject
		for _, objectPrefix := range grantObjectPrefixesForTypes(types) {
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

func grantObjectPrefixesForTypes(types []*authzextv1.ResourceType) []string {
	if len(types) == 0 {
		return grantObjectPrefixes
	}

	prefixes := []string{common.TypeFolderPrefix}
	seen := map[string]struct{}{common.TypeFolderPrefix: {}}
	appendPrefix := func(prefix string) {
		if _, ok := seen[prefix]; ok {
			return
		}
		seen[prefix] = struct{}{}
		prefixes = append(prefixes, prefix)
	}

	for _, resourceType := range types {
		if resourceType.GetGroup() == "" || resourceType.GetResource() == "" {
			continue
		}

		groupResource := common.FormatGroupResource(resourceType.GetGroup(), resourceType.GetResource(), resourceType.GetSubresource())
		appendPrefix(common.TypeGroupResoucePrefix + groupResource)
		appendPrefix(common.TypeResourcePrefix + groupResource + "/")

		switch {
		case resourceType.GetGroup() == iamv0.TeamResourceInfo.GroupResource().Group &&
			resourceType.GetResource() == iamv0.TeamResourceInfo.GroupResource().Resource:
			appendPrefix(common.TypeTeamPrefix)
		case resourceType.GetGroup() == iamv0.UserResourceInfo.GroupResource().Group &&
			resourceType.GetResource() == iamv0.UserResourceInfo.GroupResource().Resource:
			appendPrefix(common.TypeUser + ":")
		case resourceType.GetGroup() == iamv0.ServiceAccountResourceInfo.GroupResource().Group &&
			resourceType.GetResource() == iamv0.ServiceAccountResourceInfo.GroupResource().Resource:
			appendPrefix(common.TypeServiceAccount + ":")
		}
	}

	return prefixes
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

	if len(queue) > 0 {
		return nil, fmt.Errorf("role nesting exceeds maximum depth of %d", maxRoleNestDepth)
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
	pageSize := s.cfg.ReadPageSize
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
