package server

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

const (
	permissionPrincipalConcurrency = 8
	permissionPrincipalMaxTuples   = 100000
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

// Dependencies remain separate from grants so changing a shared team or role
// never requires finding and evicting all users who previously referenced it.
func (s *Server) resolveUserPermissionContributions(ctx context.Context, req *authzv1.GetUserPermissionsRequest) ([]permissionListResult, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	store, err := s.getStoreInfo(ctx, req.GetNamespace())
	if err != nil {
		return nil, err
	}
	skip := req.GetOptions().GetSkipcache()

	// Contextual memberships belong only to this request, including their implied
	// team permissions. They are never added to a cached user contribution.
	contextuals, err := s.getContextuals(req.GetSubject(), req.GetTeams())
	if err != nil {
		return nil, err
	}
	contextual, err := translatePermissionGrants(ctx, contextuals.GetTupleKeys())
	if err != nil {
		return nil, err
	}
	contributions := [][]permissionListResult{contextual}
	pending := []string{req.GetSubject()}
	for _, grant := range contextuals.GetTupleKeys() {
		if dependency := permissionDependency(grant); dependency != "" {
			pending = append(pending, dependency)
		}
	}
	visited := make(map[string]struct{})
	total := 0
	for len(pending) > 0 {
		group, groupCtx := errgroup.WithContext(ctx)
		group.SetLimit(permissionPrincipalConcurrency)
		var mu sync.Mutex
		next := []string{}
		for _, principal := range pending {
			if _, ok := visited[principal]; ok {
				continue
			}
			visited[principal] = struct{}{}
			if len(visited) > permissionPrincipalMaxTuples {
				return nil, status.Error(codes.ResourceExhausted, "permission principal limit exceeded")
			}
			group.Go(func() error {
				contribution, err := s.cachedPermissionContribution(groupCtx, permissionPrincipalKey{store.ID, store.ModelID, principal}, skip, func(ctx context.Context) (*permissionContribution, error) {
					return s.readPermissionContribution(ctx, store.ID, principal)
				})
				if err != nil {
					return err
				}
				mu.Lock()
				defer mu.Unlock()
				total += contribution.tupleCount
				if total > permissionPrincipalMaxTuples {
					return status.Error(codes.ResourceExhausted, "permission tuple limit exceeded")
				}
				contributions = append(contributions, contribution.grants)
				next = append(next, contribution.dependencies...)
				return nil
			})
		}
		if err := group.Wait(); err != nil {
			return nil, err
		}
		pending = next
	}
	return composePermissionContributions(contributions), nil
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
		if len(tuples) >= permissionPrincipalMaxTuples {
			return status.Error(codes.ResourceExhausted, "permission tuple limit exceeded")
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
