package reconciler

import (
	"context"
	"errors"
	"strings"

	claims "github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/team"
)

const teamIDScopePrefix = "teams:id:"

// errTeamStoreUnsupported is returned by the bulk team store for non-team lookups. The
// reconciler only resolves team scopes, so user/service-account methods are never called.
var errTeamStoreUnsupported = errors.New("bulk team store only resolves teams")

// teamScopeStore is a legacy.ScopeResolverStore backed by an in-memory team index built
// once per namespace from unified storage (the deprecatedInternalID label). It lets the
// reconciler reuse the shared legacy.ResolveIDScopeToUID helper without legacy SQL or N
// point lookups — the bulk fetch happens at construction. Only the team methods are
// implemented; the rest fail loudly if ever reached.
type teamScopeStore struct {
	uidByID map[int64]string
	idByUID map[string]int64
}

var _ legacy.ScopeResolverStore = (*teamScopeStore)(nil)

func (s *teamScopeStore) GetTeamUIDByID(_ context.Context, _ claims.NamespaceInfo, q legacy.GetTeamUIDByIDQuery) (*legacy.GetTeamUIDByIDResult, error) {
	uid, ok := s.uidByID[q.ID]
	if !ok {
		return nil, team.ErrTeamNotFound
	}
	return &legacy.GetTeamUIDByIDResult{UID: uid}, nil
}

func (s *teamScopeStore) GetTeamInternalID(_ context.Context, _ claims.NamespaceInfo, q legacy.GetTeamInternalIDQuery) (*legacy.GetTeamInternalIDResult, error) {
	id, ok := s.idByUID[q.UID]
	if !ok {
		return nil, team.ErrTeamNotFound
	}
	return &legacy.GetTeamInternalIDResult{ID: id}, nil
}

func (s *teamScopeStore) GetUserInternalID(context.Context, claims.NamespaceInfo, legacy.GetUserInternalIDQuery) (*legacy.GetUserInternalIDResult, error) {
	return nil, errTeamStoreUnsupported
}

func (s *teamScopeStore) GetServiceAccountInternalID(context.Context, claims.NamespaceInfo, legacy.GetServiceAccountInternalIDQuery) (*legacy.GetServiceAccountInternalIDResult, error) {
	return nil, errTeamStoreUnsupported
}

func (s *teamScopeStore) GetUserUIDByID(context.Context, claims.NamespaceInfo, legacy.GetUserUIDByIDQuery) (*legacy.GetUserUIDByIDResult, error) {
	return nil, errTeamStoreUnsupported
}

func (s *teamScopeStore) GetServiceAccountUIDByID(context.Context, claims.NamespaceInfo, legacy.GetUserUIDByIDQuery) (*legacy.GetUserUIDByIDResult, error) {
	return nil, errTeamStoreUnsupported
}

// buildTeamScopeStore lists the namespace's Team CRDs once and indexes them by uid and
// deprecatedInternalID (assigned by unified storage), returning a bulk
// legacy.ScopeResolverStore. It works in mode 5 — no legacy SQL.
func (r *Reconciler) buildTeamScopeStore(ctx context.Context, ns claims.NamespaceInfo) (legacy.ScopeResolverStore, error) {
	ctx, span := r.tracer.Start(ctx, "reconciler.buildTeamScopeStore")
	defer span.End()

	crd := iamv0.TeamResourceInfo.GroupVersionResource()

	clients, err := r.clientFactory.Clients(ctx, ns.Value)
	if err != nil {
		return nil, tracing.Errorf(span, "failed to get clients for namespace %s: %w", ns.Value, err)
	}
	resourceClient, _, err := clients.ForResource(ctx, crd)
	if err != nil {
		return nil, tracing.Errorf(span, "failed to get client for %s: %w", crd.String(), err)
	}

	store := &teamScopeStore{uidByID: map[int64]string{}, idByUID: map[string]int64{}}
	err = listAndProcess(ctx, resourceClient, r.cfg.listPageSize(), func(item *unstructured.Unstructured) error {
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			return err
		}
		if id := meta.GetDeprecatedInternalID(); id != 0 { //nolint:staticcheck
			store.uidByID[id] = item.GetName()
			store.idByUID[item.GetName()] = id
		}
		return nil
	})
	if err != nil {
		return nil, tracing.Error(span, err)
	}

	return store, nil
}

// rolesReconciled reports whether this reconcile pass involves Role or GlobalRole
// translation, the only sources of id-based team scopes. GlobalRole permissions are
// fetched cluster-wide and injected per namespace, so a non-empty set counts too.
func (r *Reconciler) rolesReconciled(globalRolePerms map[string][]*authzextv1.RolePermission) bool {
	if len(globalRolePerms) > 0 {
		return true
	}
	for _, crd := range r.cfg.CRDs {
		if crd.Resource == "roles" {
			return true
		}
	}
	return false
}

// resolveTeamScopes rewrites legacy id-based team scopes (teams:id:N) to their uid form
// (teams:uid:X) via the shared legacy.ResolveIDScopeToUID helper, so the translation layer
// can emit per-instance team tuples. Only team scopes are routed through the store; every
// other scope passes through untouched. Permissions whose team no longer exists are
// dropped (the helper logs a warning) so one orphan doesn't fail the namespace. The input
// slice and its elements are never mutated.
func resolveTeamScopes(ctx context.Context, store legacy.ScopeResolverStore, ns claims.NamespaceInfo, logger log.Logger, perms []*authzextv1.RolePermission) ([]*authzextv1.RolePermission, error) {
	if store == nil {
		return perms, nil
	}

	out := make([]*authzextv1.RolePermission, 0, len(perms))
	for _, p := range perms {
		if !strings.HasPrefix(p.Scope, teamIDScopePrefix) {
			out = append(out, p)
			continue
		}

		resolved, drop, err := legacy.ResolveIDScopeToUID(ctx, store, ns, p.Scope, logger)
		if err != nil {
			return nil, err
		}
		if drop {
			continue
		}
		if resolved == p.Scope {
			out = append(out, p)
			continue
		}
		out = append(out, &authzextv1.RolePermission{Action: p.Action, Scope: resolved})
	}

	return out, nil
}
