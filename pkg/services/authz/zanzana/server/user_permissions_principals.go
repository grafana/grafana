package server

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/tuple"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
)

const (
	permissionPrincipalConcurrency = 8
	permissionPrincipalMaxCount    = 100000
	permissionPrincipalLoadTimeout = 10 * time.Second
)

type permissionListResult struct {
	Entry common.ActionListEntry
	List  *authzv1.ListResponse
}

type permissionContribution struct {
	grants       []permissionListResult
	dependencies []string
	tupleCount   int
}

// The schema has flat teams and non-nested roles. Dependencies stay separate
// from grants so shared team and role changes do not require evicting users.
func (s *Server) resolveUserPermissions(ctx context.Context, req *authzv1.GetUserPermissionsRequest) ([]accesscontrol.Permission, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	store, err := s.getStoreInfo(ctx, req.GetNamespace())
	if err != nil {
		return nil, err
	}
	skip := req.GetOptions().GetSkipcache()

	user, err := s.loadPermissionContribution(ctx, store, req.GetSubject(), skip)
	if err != nil {
		return nil, err
	}
	var teams, roles []string
	for _, dependency := range user.dependencies {
		switch permissionDependencyType(dependency) {
		case common.TypeTeam:
			teams = append(teams, dependency)
		case common.TypeRole:
			roles = append(roles, dependency)
		default:
			return nil, unsupportedPermissionGrant()
		}
	}

	// Contextual memberships and their implied permissions remain request-local.
	contextuals, err := s.getContextuals(req.GetSubject(), req.GetTeams())
	if err != nil {
		return nil, err
	}
	contextual, err := translatePermissionGrants(ctx, contextuals.GetTupleKeys())
	if err != nil {
		return nil, err
	}
	for _, grant := range contextuals.GetTupleKeys() {
		if dependency := permissionDependency(grant); dependency != "" {
			if permissionDependencyType(dependency) != common.TypeTeam {
				return nil, unsupportedPermissionGrant()
			}
			teams = append(teams, dependency)
		}
	}
	slices.Sort(teams)
	teams = slices.Compact(teams)
	if 1+len(teams) > permissionPrincipalMaxCount {
		return nil, status.Error(codes.ResourceExhausted, "permission principal limit exceeded")
	}
	teamContributions, err := s.loadPermissionContributions(ctx, store, teams, skip)
	if err != nil {
		return nil, err
	}
	contributions := [][]permissionListResult{user.grants, contextual}
	for _, team := range teamContributions {
		contributions = append(contributions, team.grants)
		for _, dependency := range team.dependencies {
			if permissionDependencyType(dependency) != common.TypeRole {
				return nil, unsupportedPermissionGrant()
			}
			roles = append(roles, dependency)
		}
	}

	slices.Sort(roles)
	roles = slices.Compact(roles)
	if 1+len(teams)+len(roles) > permissionPrincipalMaxCount {
		return nil, status.Error(codes.ResourceExhausted, "permission principal limit exceeded")
	}
	roleContributions, err := s.loadPermissionContributions(ctx, store, roles, skip)
	if err != nil {
		return nil, err
	}
	for _, role := range roleContributions {
		if len(role.dependencies) != 0 {
			return nil, unsupportedPermissionGrant()
		}
		contributions = append(contributions, role.grants)
	}

	results := composePermissionContributions(contributions)
	lists := make([]legacyscopes.PermissionList, 0, len(results))
	for _, result := range results {
		lists = append(lists, legacyscopes.PermissionList{Resource: result.Entry.Resource, Action: result.Entry.Action, List: result.List})
	}
	return legacyscopes.ResolvePermissions(ctx, "", lists)
}

func (s *Server) loadPermissionContribution(ctx context.Context, store *zanzana.StoreInfo, principal string, skip bool) (*permissionContribution, error) {
	return s.cachedPermissionContribution(ctx, permissionPrincipalKey{store.ID, store.ModelID, principal}, skip, func(ctx context.Context) (*permissionContribution, error) {
		return s.readPermissionContribution(ctx, store.ID, principal)
	})
}

func (s *Server) loadPermissionContributions(ctx context.Context, store *zanzana.StoreInfo, principals []string, skip bool) ([]*permissionContribution, error) {
	results := make([]*permissionContribution, len(principals))
	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(permissionPrincipalConcurrency)
	for i, principal := range principals {
		group.Go(func() error {
			contribution, err := s.loadPermissionContribution(groupCtx, store, principal, skip)
			if err != nil {
				return err
			}
			results[i] = contribution
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return nil, err
	}
	return results, nil
}

func permissionDependencyType(principal string) string {
	object, relation, _ := strings.Cut(principal, "#")
	kind, name, _ := strings.Cut(object, ":")
	if !tuple.IsValidUser(principal) || name == "" || strings.Contains(name, "*") {
		return ""
	}
	if kind == common.TypeTeam && relation == common.RelationTeamMember || kind == common.TypeRole && relation == common.RelationAssignee {
		return kind
	}
	return ""
}

func (s *Server) readPermissionContribution(ctx context.Context, store, principal string) (*permissionContribution, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	iterator, err := s.store.Read(ctx, store, storage.ReadFilter{User: principal}, storage.ReadOptions{})
	if err != nil {
		return nil, fmt.Errorf("read permission principal: %w", err)
	}
	defer iterator.Stop()
	var tuples []*openfgav1.TupleKey
	var dependencies []string
	err = collectPermissionTuples(ctx, iterator, func(grant *openfgav1.TupleKey) error {
		if grant == nil || grant.GetUser() != principal {
			return unsupportedPermissionGrant()
		}
		tuples = append(tuples, grant)
		if dependency := permissionDependency(grant); dependency != "" {
			dependencies = append(dependencies, dependency)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	grants, err := translatePermissionGrants(ctx, tuples)
	if err != nil {
		return nil, err
	}
	var nonempty []permissionListResult
	for _, grant := range grants {
		if grant.List.All || len(grant.List.Items) > 0 || len(grant.List.Folders) > 0 {
			nonempty = append(nonempty, grant)
		}
	}
	return &permissionContribution{grants: nonempty, dependencies: dependencies, tupleCount: len(tuples)}, nil
}

func permissionDependency(grant *openfgav1.TupleKey) string {
	if strings.HasPrefix(grant.GetObject(), common.TypeTeamPrefix) && (grant.GetRelation() == common.RelationTeamMember || grant.GetRelation() == common.RelationTeamAdmin) {
		return grant.GetObject() + "#" + common.RelationTeamMember
	}
	if strings.HasPrefix(grant.GetObject(), common.TypeRole+":") && grant.GetRelation() == common.RelationAssignee {
		return grant.GetObject() + "#" + common.RelationAssignee
	}
	return ""
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
