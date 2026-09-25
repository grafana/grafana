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
	batches [][]string
	err     error
}

func (v *recordingRuleMutationValidator) ValidateRuleMutations(_ context.Context, rules []*models.AlertRule, _ utils.ManagerProperties) error {
	titles := make([]string, 0, len(rules))
	for _, rule := range rules {
		titles = append(titles, rule.Title)
	}
	v.batches = append(v.batches, titles)
	return v.err
}

func TestNoopRuleMutationValidator(t *testing.T) {
	require.NoError(t, NoopRuleMutationValidator{}.ValidateRuleMutations(context.Background(), []*models.AlertRule{{}}, utils.ManagerProperties{}))
}

func TestValidateRuleMutations(t *testing.T) {
	rules := []*models.AlertRule{{Title: "CPU high"}, {Title: "Memory high"}}

	t.Run("no validator configured accepts the mutation", func(t *testing.T) {
		service := &AlertRuleService{}

		require.NoError(t, service.validateRuleMutations(context.Background(), rules, utils.ManagerProperties{}))
	})

	t.Run("the configured validator sees every rule in one batch", func(t *testing.T) {
		validator := &recordingRuleMutationValidator{}
		service := &AlertRuleService{ruleValidator: validator}

		require.NoError(t, service.validateRuleMutations(context.Background(), rules, utils.ManagerProperties{}))
		assert.Equal(t, [][]string{{"CPU high", "Memory high"}}, validator.batches)
	})

	t.Run("nil rules are dropped", func(t *testing.T) {
		validator := &recordingRuleMutationValidator{}
		service := &AlertRuleService{ruleValidator: validator}

		require.NoError(t, service.validateRuleMutations(context.Background(), []*models.AlertRule{nil, rules[0]}, utils.ManagerProperties{}))
		assert.Equal(t, [][]string{{"CPU high"}}, validator.batches)
	})

	t.Run("a write with nothing to validate does not reach the validator", func(t *testing.T) {
		validator := &recordingRuleMutationValidator{}
		service := &AlertRuleService{ruleValidator: validator}

		require.NoError(t, service.validateRuleMutations(context.Background(), nil, utils.ManagerProperties{}))
		assert.Empty(t, validator.batches)
	})

	t.Run("a rejection is returned to the caller", func(t *testing.T) {
		rejected := errors.New("missing required annotation")
		service := &AlertRuleService{ruleValidator: &recordingRuleMutationValidator{err: rejected}}

		assert.ErrorIs(t, service.validateRuleMutations(context.Background(), rules, utils.ManagerProperties{}), rejected)
	})

	t.Run("the manager is passed through", func(t *testing.T) {
		var got utils.ManagerProperties
		service := &AlertRuleService{ruleValidator: managerCapturingValidator{&got}}
		manager := utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "tf-1"}

		require.NoError(t, service.validateRuleMutations(context.Background(), rules, manager))
		assert.Equal(t, manager, got)
	})
}

type managerCapturingValidator struct{ got *utils.ManagerProperties }

func (v managerCapturingValidator) ValidateRuleMutations(_ context.Context, _ []*models.AlertRule, manager utils.ManagerProperties) error {
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
		assert.Equal(t, [][]string{{rule.Title}}, validator.batches)
	})

	t.Run("UpdateAlertRule", func(t *testing.T) {
		service, validator := initWithData(t)
		rule := models.CopyRule(stored[0])
		rule.Title = rule.Title + "_new"

		_, err := service.UpdateAlertRule(context.Background(), u, *rule, manager)

		require.NoError(t, err)
		assert.Equal(t, [][]string{{rule.Title}}, validator.batches)
	})

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
		assert.Equal(t, [][]string{{replacement.Title}}, validator.batches)
	})

	t.Run("ReplaceRuleGroup sends added and updated rules as a single batch", func(t *testing.T) {
		service, validator := initWithData(t)
		updated := models.CopyRule(stored[0])
		updated.Title = updated.Title + "_updated"
		added := gen.With(gen.WithGroupKey(groupKey), gen.WithIntervalSeconds(30)).Generate()
		added.UID = ""
		group := models.AlertRuleGroup{
			Title:      groupKey.RuleGroup,
			FolderUID:  groupKey.NamespaceUID,
			Interval:   30,
			Provenance: models.ProvenanceAPI,
			Rules:      []models.AlertRule{*updated, added},
		}

		err := service.ReplaceRuleGroup(context.Background(), u, group, manager, "")

		require.NoError(t, err)
		require.Len(t, validator.batches, 1)
		assert.ElementsMatch(t, []string{updated.Title, added.Title}, validator.batches[0])
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
