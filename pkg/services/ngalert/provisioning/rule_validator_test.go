package provisioning

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type recordingRuleMutationValidator struct {
	seen []string
	err  error
}

func (v *recordingRuleMutationValidator) ValidateRuleMutation(_ context.Context, rule *models.AlertRule, _ utils.ManagerProperties) error {
	v.seen = append(v.seen, rule.Title)
	return v.err
}

func TestNoopRuleMutationValidator(t *testing.T) {
	require.NoError(t, NoopRuleMutationValidator{}.ValidateRuleMutation(context.Background(), &models.AlertRule{}, utils.ManagerProperties{}))
}

func TestValidateRuleMutation(t *testing.T) {
	rule := &models.AlertRule{Title: "CPU high"}

	t.Run("no validator configured accepts the mutation", func(t *testing.T) {
		service := &AlertRuleService{}

		require.NoError(t, service.validateRuleMutation(context.Background(), rule, utils.ManagerProperties{}))
	})

	t.Run("the configured validator sees the rule", func(t *testing.T) {
		validator := &recordingRuleMutationValidator{}
		service := &AlertRuleService{ruleValidator: validator}

		require.NoError(t, service.validateRuleMutation(context.Background(), rule, utils.ManagerProperties{}))
		assert.Equal(t, []string{"CPU high"}, validator.seen)
	})

	t.Run("a rejection is returned to the caller", func(t *testing.T) {
		rejected := errors.New("missing required annotation")
		service := &AlertRuleService{ruleValidator: &recordingRuleMutationValidator{err: rejected}}

		assert.ErrorIs(t, service.validateRuleMutation(context.Background(), rule, utils.ManagerProperties{}), rejected)
	})

	// The gate needs this to tell an as-code write from a boot-time one.
	t.Run("the manager is passed through", func(t *testing.T) {
		var got utils.ManagerProperties
		service := &AlertRuleService{ruleValidator: managerCapturingValidator{&got}}
		manager := utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "tf-1"}

		require.NoError(t, service.validateRuleMutation(context.Background(), rule, manager))
		assert.Equal(t, manager, got)
	})
}

type managerCapturingValidator struct{ got *utils.ManagerProperties }

func (v managerCapturingValidator) ValidateRuleMutation(_ context.Context, _ *models.AlertRule, manager utils.ManagerProperties) error {
	*v.got = manager
	return nil
}
