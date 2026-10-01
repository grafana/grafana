package teamlbac

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/registry/generic"
)

func TestTeamLBACRuleStatusIsSystemOwnedOnSpecWrites(t *testing.T) {
	strategy := generic.NewStrategy(runtime.NewScheme(), iamv0.SchemeGroupVersion)
	forgedStatus := iamv0.TeamLBACRuleStatus{Conditions: []iamv0.TeamLBACRuleCondition{{
		Type:   iamv0.TeamLBACRuleConditionTypeEnforceable,
		Status: iamv0.TeamLBACRuleConditionStatusTrue,
		Reason: iamv0.TeamLBACRuleConditionReasonReady,
	}}}

	t.Run("create clears client supplied status", func(t *testing.T) {
		rule := iamv0.NewTeamLBACRule()
		rule.Status = forgedStatus

		strategy.PrepareForCreate(t.Context(), rule)

		require.Empty(t, rule.Status.Conditions)
	})

	t.Run("update retains the existing status", func(t *testing.T) {
		oldRule := iamv0.NewTeamLBACRule()
		oldRule.Status.Conditions = []iamv0.TeamLBACRuleCondition{{
			Type:   iamv0.TeamLBACRuleConditionTypeEnforceable,
			Status: iamv0.TeamLBACRuleConditionStatusFalse,
			Reason: iamv0.TeamLBACRuleConditionReasonBasicAuthDisabled,
		}}
		newRule := oldRule.DeepCopy()
		newRule.Status = forgedStatus

		strategy.PrepareForUpdate(t.Context(), newRule, oldRule)

		require.Equal(t, oldRule.Status, newRule.Status)
	})
}
