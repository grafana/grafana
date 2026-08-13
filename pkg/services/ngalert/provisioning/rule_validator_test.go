package provisioning

import (
	"context"
	"errors"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
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

	// The gate filters on this to tell an as-code write from a boot-time one.
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

func TestRuleMutationValidatorIsReachedFromEveryWritePath(t *testing.T) {
	orgID := rand.Int63()
	u := &user.SignedInUser{OrgID: orgID}
	groupKey := models.GenerateGroupKey(orgID)
	gen := models.RuleGen
	stored := gen.With(gen.WithGroupKey(groupKey), gen.WithIntervalSeconds(30)).GenerateManyRef(1)
	manager := models.ProvenanceToManagerProperties(models.ProvenanceAPI)

	initWithData := func(t *testing.T) (*AlertRuleService, *recordingRuleMutationValidator) {
		t.Helper()
		service, ruleStore, provenanceStore, ac := initService(t)
		ruleStore.Rules = map[int64][]*models.AlertRule{orgID: stored}
		for _, rule := range stored {
			require.NoError(t, provenanceStore.SetProvenance(context.Background(), rule, orgID, models.ProvenanceAPI))
		}
		ac.CanWriteAllRulesFunc = func(context.Context, identity.Requester) (bool, error) { return true, nil }

		validator := &recordingRuleMutationValidator{}
		service.ruleValidator = validator
		return service, validator
	}

	t.Run("CreateAlertRule", func(t *testing.T) {
		service, validator := initWithData(t)
		rule := gen.With(gen.WithOrgID(orgID)).Generate()

		_, err := service.CreateAlertRule(context.Background(), u, rule, manager)

		require.NoError(t, err)
		assert.Equal(t, []string{rule.Title}, validator.seen)
	})

	t.Run("UpdateAlertRule", func(t *testing.T) {
		service, validator := initWithData(t)
		rule := models.CopyRule(stored[0])
		rule.Title = rule.Title + "_new"

		_, err := service.UpdateAlertRule(context.Background(), u, *rule, manager)

		require.NoError(t, err)
		assert.Equal(t, []string{rule.Title}, validator.seen)
	})

	// Bypasses CreateAlertRule and UpdateAlertRule, so it needs its own call site.
	t.Run("ReplaceRuleGroup", func(t *testing.T) {
		service, validator := initWithData(t)
		replacement := models.CopyRule(stored[0])
		replacement.Title = replacement.Title + "_replaced"
		group := models.AlertRuleGroup{
			Title:      groupKey.RuleGroup,
			FolderUID:  groupKey.NamespaceUID,
			Interval:   30,
			Provenance: models.ProvenanceAPI,
			Rules:      []models.AlertRule{*replacement},
		}

		err := service.ReplaceRuleGroup(context.Background(), u, group, manager, "")

		require.NoError(t, err)
		assert.Contains(t, validator.seen, replacement.Title)
	})

	t.Run("a rejection stops the write", func(t *testing.T) {
		service, _ := initWithData(t)
		rejected := errors.New("missing required annotation")
		service.ruleValidator = &recordingRuleMutationValidator{err: rejected}
		rule := gen.With(gen.WithOrgID(orgID)).Generate()

		_, err := service.CreateAlertRule(context.Background(), u, rule, manager)

		assert.ErrorIs(t, err, rejected)
	})
}
