package common

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	ngalertaccesscontrol "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// CanWriteRule and CanDeleteRule report the requester's effective write/delete
// capability for a rule, scoped to its folder. Each checks exactly the
// evaluator accesscontrol.RuleService.AuthorizeRuleChanges checks for an
// in-place update or a delete that does not move the rule between folders --
// the same access-control service and permission the mutation path
// authorizes against, not a separate reimplementation.
//
// This is a response hint, not an authorization decision: a mutation still
// re-checks access when it runs, including checks this does not model (query
// datasource access, notification settings, cross-folder moves).
func CanWriteRule(ctx context.Context, ac *ngalertaccesscontrol.RuleService, user identity.Requester, rule ngmodels.Namespaced) (bool, error) {
	scope := folder.ScopeFoldersProvider.GetResourceScopeUID(rule.GetNamespaceUID())
	return ac.HasAccess(ctx, user, accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleUpdate, scope))
}

func CanDeleteRule(ctx context.Context, ac *ngalertaccesscontrol.RuleService, user identity.Requester, rule ngmodels.Namespaced) (bool, error) {
	scope := folder.ScopeFoldersProvider.GetResourceScopeUID(rule.GetNamespaceUID())
	return ac.HasAccess(ctx, user, accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleDelete, scope))
}
