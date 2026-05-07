package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	// Asserts pre-conditions for read access to inhibition rules. If this evaluates to false, the user cannot read any inhibition rules.
	readInhibitionRulesPreConditionsEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsRead),                // Global action for all AM config. Org scope.
		ac.EvalPermission(ac.ActionAlertingNotificationsInhibitionRulesRead), // Action for inhibition rules. UID scope.
	)

	// Asserts read-only access to a specific inhibition rule.
	readInhibitionRuleEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),
			ac.EvalPermission(ac.ActionAlertingNotificationsInhibitionRulesRead, models.ScopeInhibitionRulesProvider.GetResourceScopeUID(uid)),
		)
	}

	// Asserts pre-conditions for write access to inhibition rules. If this evaluates to false, the user cannot write any inhibition rules.
	writeInhibitionRulesPreConditionsEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite),                // Global action for all AM config. Org scope.
		ac.EvalPermission(ac.ActionAlertingNotificationsInhibitionRulesWrite), // Action for inhibition rules. UID scope.
	)

	// Asserts write access to a specific inhibition rule.
	writeInhibitionRuleEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
			ac.EvalPermission(ac.ActionAlertingNotificationsInhibitionRulesWrite, models.ScopeInhibitionRulesProvider.GetResourceScopeUID(uid)),
		)
	}

	// Asserts delete access to a specific inhibition rule.
	deleteInhibitionRuleEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
			ac.EvalPermission(ac.ActionAlertingNotificationsInhibitionRulesDelete, models.ScopeInhibitionRulesProvider.GetResourceScopeUID(uid)),
		)
	}
)

// InhibitionRuleAccess provides access control for inhibition rules.
type InhibitionRuleAccess struct {
	genericService
}

func NewInhibitionRuleAccess(ac ac.AccessControl) *InhibitionRuleAccess {
	return &InhibitionRuleAccess{
		genericService: genericService{ac: ac},
	}
}

// AuthorizeReadSome checks if user has access to read some inhibition rules. Returns an error if user does not have access.
func (s InhibitionRuleAccess) AuthorizeReadSome(ctx context.Context, user identity.Requester) error {
	return s.HasAccessOrError(ctx, user, readInhibitionRulesPreConditionsEval, func() string {
		return "read any inhibition rule"
	})
}

// AuthorizeReadByUID checks if user has access to read a specific inhibition rule by uid. Returns an error if user does not have access.
func (s InhibitionRuleAccess) AuthorizeReadByUID(ctx context.Context, user identity.Requester, uid string) error {
	return s.HasAccessOrError(ctx, user, readInhibitionRuleEval(uid), func() string {
		return "read inhibition rule"
	})
}

// AuthorizeCreate checks if user has access to create inhibition rules. Returns an error if user does not have access.
func (s InhibitionRuleAccess) AuthorizeCreate(ctx context.Context, user identity.Requester) error {
	return s.HasAccessOrError(ctx, user, writeInhibitionRulesPreConditionsEval, func() string {
		return "create inhibition rule"
	})
}

// AuthorizeUpdateByUID checks if user has access to update a specific inhibition rule by uid. Returns an error if user does not have access.
func (s InhibitionRuleAccess) AuthorizeUpdateByUID(ctx context.Context, user identity.Requester, uid string) error {
	return s.HasAccessOrError(ctx, user, writeInhibitionRuleEval(uid), func() string {
		return "update inhibition rule"
	})
}

// AuthorizeDeleteByUID checks if user has access to delete a specific inhibition rule by uid. Returns an error if user does not have access.
func (s InhibitionRuleAccess) AuthorizeDeleteByUID(ctx context.Context, user identity.Requester, uid string) error {
	return s.HasAccessOrError(ctx, user, deleteInhibitionRuleEval(uid), func() string {
		return "delete inhibition rule"
	})
}
