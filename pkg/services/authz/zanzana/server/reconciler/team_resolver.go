package reconciler

import (
	"context"
	"errors"
	"strconv"
	"strings"

	claims "github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz/idresolver"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

const teamIDScopePrefix = "teams:id:"

// bulkTeamClient resolves teams from a per-namespace map sourced from unified storage
// (the deprecatedInternalID label). It satisfies idresolver.TeamClient and is the
// mode-5 backing for the reconciler, which has no legacy SQL. The map is built for a
// single namespace, so the ns argument is ignored.
type bulkTeamClient struct {
	byID  map[int64]string
	byUID map[string]int64
}

var _ idresolver.TeamClient = (*bulkTeamClient)(nil)

func (c *bulkTeamClient) UIDByID(_ context.Context, _ claims.NamespaceInfo, id int64) (string, error) {
	uid, ok := c.byID[id]
	if !ok {
		return "", idresolver.ErrNotFound
	}
	return uid, nil
}

func (c *bulkTeamClient) IDByUID(_ context.Context, _ claims.NamespaceInfo, uid string) (int64, error) {
	id, ok := c.byUID[uid]
	if !ok {
		return 0, idresolver.ErrNotFound
	}
	return id, nil
}

// buildTeamResolver lists the namespace's Team CRDs and returns an idresolver.Resolver
// backed by a uid<->id map (from the deprecatedInternalID label, assigned by unified
// storage). It works in mode 5: no legacy SQL and no feature toggles, so team lookups
// always go through the client.
func (r *Reconciler) buildTeamResolver(ctx context.Context, namespace string) (idresolver.Resolver, error) {
	ctx, span := r.tracer.Start(ctx, "reconciler.buildTeamResolver")
	defer span.End()

	crd := iamv0.TeamResourceInfo.GroupVersionResource()

	clients, err := r.clientFactory.Clients(ctx, namespace)
	if err != nil {
		return nil, tracing.Errorf(span, "failed to get clients for namespace %s: %w", namespace, err)
	}
	resourceClient, _, err := clients.ForResource(ctx, crd)
	if err != nil {
		return nil, tracing.Errorf(span, "failed to get client for %s: %w", crd.String(), err)
	}

	byID := make(map[int64]string)
	byUID := make(map[string]int64)
	err = listAndProcess(ctx, resourceClient, r.cfg.listPageSize(), func(item *unstructured.Unstructured) error {
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			return err
		}
		if id := meta.GetDeprecatedInternalID(); id != 0 { //nolint:staticcheck
			byID[id] = item.GetName()
			byUID[item.GetName()] = id
		}
		return nil
	})
	if err != nil {
		return nil, tracing.Error(span, err)
	}

	return idresolver.NewResolver(nil, &bulkTeamClient{byID: byID, byUID: byUID}, nil), nil
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
// (teams:uid:X) using the shared resolver, so the translation layer can emit per-instance
// team tuples. Wildcard team scopes (teams:id:*) and every non-team scope pass through
// untouched. Permissions whose team no longer exists are dropped with a warning: the
// reconciler is a background sync, so one orphaned scope must not fail the namespace.
// The input slice and its elements are never mutated.
func resolveTeamScopes(ctx context.Context, resolver idresolver.Resolver, ns claims.NamespaceInfo, logger log.Logger, perms []*authzextv1.RolePermission) ([]*authzextv1.RolePermission, error) {
	if resolver == nil {
		return perms, nil
	}

	out := make([]*authzextv1.RolePermission, 0, len(perms))
	for _, p := range perms {
		idStr, ok := strings.CutPrefix(p.Scope, teamIDScopePrefix)
		if !ok || idStr == "*" {
			out = append(out, p)
			continue
		}

		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			// Not a numeric id — leave it for the translation layer to handle/drop.
			out = append(out, p)
			continue
		}

		uid, err := resolver.IDToUID(ctx, ns, idresolver.KindTeam, id)
		if err != nil {
			if errors.Is(err, idresolver.ErrNotFound) {
				if logger != nil {
					logger.Warn("Dropping permission with orphaned team scope", "action", p.Action, "scope", p.Scope)
				}
				continue
			}
			return nil, err
		}

		out = append(out, &authzextv1.RolePermission{Action: p.Action, Scope: "teams:uid:" + uid})
	}

	return out, nil
}
