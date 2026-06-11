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

var _ idresolver.TeamLister = (*Reconciler)(nil)

// ListTeams implements idresolver.TeamLister: it lists the namespace's Team CRDs from
// unified storage and returns each team's uid (object name) with its deprecatedInternalID
// label (assigned by unified storage). It works in mode 5 — no legacy SQL — and backs the
// bulk resolver the reconciler uses.
func (r *Reconciler) ListTeams(ctx context.Context, ns claims.NamespaceInfo) ([]idresolver.TeamRef, error) {
	ctx, span := r.tracer.Start(ctx, "reconciler.ListTeams")
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

	var teams []idresolver.TeamRef
	err = listAndProcess(ctx, resourceClient, r.cfg.listPageSize(), func(item *unstructured.Unstructured) error {
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			return err
		}
		if id := meta.GetDeprecatedInternalID(); id != 0 { //nolint:staticcheck
			teams = append(teams, idresolver.TeamRef{UID: item.GetName(), ID: id})
		}
		return nil
	})
	if err != nil {
		return nil, tracing.Error(span, err)
	}

	return teams, nil
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
// (teams:uid:X) using the resolver, so the translation layer can emit per-instance team
// tuples. Wildcard team scopes (teams:id:*) and every non-team scope pass through
// untouched. Permissions whose team no longer exists are dropped with a warning: the
// reconciler is a background sync, so one orphaned scope must not fail the namespace.
// The input slice and its elements are never mutated.
func resolveTeamScopes(ctx context.Context, resolver idresolver.Resolver, ns claims.NamespaceInfo, logger log.Logger, perms []*authzextv1.RolePermission) ([]*authzextv1.RolePermission, error) {
	if resolver == nil {
		return perms, nil
	}

	out := make([]*authzextv1.RolePermission, 0, len(perms))
	for _, p := range perms {
		id, ok := parseTeamIDScope(p.Scope)
		if !ok {
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

// parseTeamIDScope returns the numeric id of a specific team id-scope (teams:id:N).
// Wildcards (teams:id:*) and non-team / non-numeric scopes return ok=false.
func parseTeamIDScope(scope string) (int64, bool) {
	idStr, ok := strings.CutPrefix(scope, teamIDScopePrefix)
	if !ok || idStr == "*" {
		return 0, false
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return 0, false
	}
	return id, true
}
