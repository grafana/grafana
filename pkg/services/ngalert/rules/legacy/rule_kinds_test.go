package legacy

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
)

// allowAllAuthz embeds the authorization interface and grants every check the kind facades reach.
type allowAllAuthz struct {
	ruleAccessControlService
}

func (allowAllAuthz) AuthorizeRuleRead(context.Context, identity.Requester, *models.AlertRule) error {
	return nil
}
func (allowAllAuthz) CanReadAllRules(context.Context, identity.Requester) (bool, error) {
	return true, nil
}
func (allowAllAuthz) CanWriteAllRules(context.Context, identity.Requester) (bool, error) {
	return true, nil
}

type kindsEnv struct {
	user      *user.SignedInUser
	alerting  *models.AlertRule
	recording *models.AlertRule
	ruleStore *fakes.RuleStore
	// managers holds the stored manager per rule UID. The fake provenance store only keeps provenance, which loses
	// the manager kind and identity.
	managers map[string]utils.ManagerProperties
	alerts   *AlertRules
	records  *RecordingRules
}

func newKindsEnv(t *testing.T) *kindsEnv {
	t.Helper()
	const orgID = 1
	gen := models.RuleGen
	// The rules must survive models -> k8s -> models, as writes convert the object back.
	alerting := gen.With(gen.WithOrgID(orgID)).GenerateRef()
	alerting.Record = nil
	alerting.Condition = alerting.Data[0].RefID
	recording := gen.With(gen.WithOrgID(orgID), gen.WithAllRecordingRules()).GenerateRef()
	recording.Record.From = recording.Data[0].RefID

	ruleStore := fakes.NewRuleStore(t)
	ruleStore.Rules = map[int64][]*models.AlertRule{orgID: {alerting, recording}}
	managers := map[string]utils.ManagerProperties{}
	provenance := fakes.NewFakeProvisioningStore()
	provenance.GetManagerPropertiesFunc = func(_ context.Context, o models.Provisionable, _ int64) (utils.ManagerProperties, error) {
		return managers[o.ResourceID()], nil
	}
	service := &LegacyRuleService{
		ruleStore:       ruleStore,
		provenanceStore: provenance,
		log:             log.New("testing"),
		authz:           allowAllAuthz{},
		xact:            &countingTransactionManager{},
	}
	return &kindsEnv{
		user:      &user.SignedInUser{OrgID: orgID, UserUID: "editor"},
		alerting:  alerting,
		recording: recording,
		ruleStore: ruleStore,
		managers:  managers,
		alerts:    NewAlertRules(service, nsMapperForTest()),
		records:   NewRecordingRules(service, nsMapperForTest()),
	}
}

func TestRuleKindsGet(t *testing.T) {
	e := newKindsEnv(t)
	ctx := context.Background()

	t.Run("returns the rule of its own kind", func(t *testing.T) {
		alertRule, err := e.alerts.Get(ctx, e.user, e.alerting.UID)
		require.NoError(t, err)
		assert.Equal(t, e.alerting.UID, alertRule.Name)

		recordingRule, err := e.records.Get(ctx, e.user, e.recording.UID)
		require.NoError(t, err)
		assert.Equal(t, e.recording.UID, recordingRule.Name)
	})

	t.Run("reports a rule of the other kind as not found", func(t *testing.T) {
		_, err := e.alerts.Get(ctx, e.user, e.recording.UID)
		require.ErrorIs(t, err, models.ErrAlertRuleNotFound)

		_, err = e.records.Get(ctx, e.user, e.alerting.UID)
		require.ErrorIs(t, err, models.ErrAlertRuleNotFound)
	})

	t.Run("sets the stored manager on the object", func(t *testing.T) {
		manager := utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "tf"}
		e.managers[e.alerting.UID] = manager

		alertRule, err := e.alerts.Get(ctx, e.user, e.alerting.UID)
		require.NoError(t, err)
		meta, err := utils.MetaAccessor(alertRule)
		require.NoError(t, err)
		got, ok := meta.GetManagerProperties()
		require.True(t, ok)
		assert.Equal(t, manager, got)
	})
}

func TestRuleKindsListFiltersByKind(t *testing.T) {
	e := newKindsEnv(t)
	ctx := context.Background()

	// The fake store ignores the rule type, so give each call only rules of the kind it asks for, and check the
	// recorded queries. The caller's rule type is ignored: each facade only lists its own kind.
	e.ruleStore.Rules[e.user.OrgID] = []*models.AlertRule{e.alerting}
	alerts, err := e.alerts.List(ctx, e.user, ListAlertRulesOptions{RuleType: models.RuleTypeFilterRecording})
	require.NoError(t, err)
	require.Len(t, alerts.Items, 1)

	e.ruleStore.Rules[e.user.OrgID] = []*models.AlertRule{e.recording}
	records, err := e.records.List(ctx, e.user, ListAlertRulesOptions{RuleType: models.RuleTypeFilterAlerting})
	require.NoError(t, err)
	require.Len(t, records.Items, 1)

	var ruleTypes []models.RuleTypeFilter
	for _, op := range e.ruleStore.RecordedOps {
		if q, ok := op.(models.ListAlertRulesExtendedQuery); ok {
			ruleTypes = append(ruleTypes, q.RuleType)
		}
	}
	assert.Equal(t, []models.RuleTypeFilter{models.RuleTypeFilterAlerting, models.RuleTypeFilterRecording}, ruleTypes)
}

func TestRuleKindsDeleteUsesManagerFromObject(t *testing.T) {
	ctx := context.Background()
	manager := utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "tf"}
	otherManager := utils.ManagerProperties{Kind: utils.ManagerKindKubectl, Identity: "kubectl"}

	t.Run("an object with another manager is rejected", func(t *testing.T) {
		e := newKindsEnv(t)
		e.managers[e.alerting.UID] = manager
		obj, err := AlertRuleToK8s(e.alerting.OrgID, e.alerting, otherManager, nsMapperForTest())
		require.NoError(t, err)

		err = e.alerts.Delete(ctx, e.user, obj, false)
		require.ErrorContains(t, err, "provenance")
	})

	t.Run("an object carrying the stored manager is deleted", func(t *testing.T) {
		e := newKindsEnv(t)
		e.managers[e.alerting.UID] = manager
		obj, err := e.alerts.Get(ctx, e.user, e.alerting.UID)
		require.NoError(t, err)

		require.NoError(t, e.alerts.Delete(ctx, e.user, obj, false))
		_, err = e.alerts.Get(ctx, e.user, e.alerting.UID)
		require.ErrorIs(t, err, models.ErrAlertRuleNotFound)
	})

	t.Run("a batch is checked against each object's manager", func(t *testing.T) {
		e := newKindsEnv(t)
		e.managers[e.recording.UID] = manager
		managed, err := e.records.Get(ctx, e.user, e.recording.UID)
		require.NoError(t, err)
		other, err := RecordingRuleToK8s(e.recording.OrgID, e.recording, otherManager, nsMapperForTest())
		require.NoError(t, err)

		err = e.records.DeleteMany(ctx, e.user, []*v1beta1.RecordingRule{other}, false)
		require.ErrorContains(t, err, "provenance")

		require.NoError(t, e.records.DeleteMany(ctx, e.user, []*v1beta1.RecordingRule{managed}, false))
		_, err = e.records.Get(ctx, e.user, e.recording.UID)
		require.ErrorIs(t, err, models.ErrAlertRuleNotFound)
	})
}
