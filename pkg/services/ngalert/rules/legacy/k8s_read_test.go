package legacy

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// notRoundTripped lists the AlertRule fields that cannot survive models -> k8s -> models, with the reason.
// Every other exported field must be set on the source rule and come back unchanged.
var notRoundTripped = map[string]string{
	"ID":             "SQL row id, no k8s equivalent",
	"FolderFullpath": "computed from the folder service, not stored on the rule",
}

// notInRecordingRuleSpec lists the AlertRule fields that only alerting rules carry.
var notInRecordingRuleSpec = map[string]string{
	"Condition":                   "recording rules use Record.From",
	"NoDataState":                 "not part of the RecordingRule spec",
	"ExecErrState":                "not part of the RecordingRule spec",
	"For":                         "not part of the RecordingRule spec",
	"KeepFiringFor":               "not part of the RecordingRule spec",
	"Annotations":                 "not part of the RecordingRule spec",
	"NotificationSettings":        "not part of the RecordingRule spec",
	"DashboardUID":                "not part of the RecordingRule spec",
	"PanelID":                     "not part of the RecordingRule spec",
	"MissingSeriesEvalsToResolve": "not part of the RecordingRule spec",
}

func TestAlertRuleFromK8sRoundTrip(t *testing.T) {
	src := roundTripSource(t)
	src.Record = nil
	src.Condition = src.Data[0].RefID
	src.For = 5 * time.Minute
	src.KeepFiringFor = 2 * time.Minute
	src.NoDataState = ngmodels.Alerting
	src.ExecErrState = ngmodels.ErrorErrState
	src.Annotations = map[string]string{"summary": "s"}
	src.DashboardUID = new("dash")
	src.PanelID = new(int64(3))
	src.MissingSeriesEvalsToResolve = new(int64(4))
	src.NotificationSettings = &ngmodels.NotificationSettings{
		ContactPointRouting: &ngmodels.ContactPointRouting{Receiver: "recv", GroupBy: []string{"alertname"}},
	}
	src.K8sStatus = mustMarshal(t, v1beta1.AlertRuleStatus{LastError: new("boom")})
	managerProps := utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "tf"}

	k8sRule, err := AlertRuleToK8s(src.OrgID, src, managerProps, nsMapperForTest())
	require.NoError(t, err)

	got, gotManagerProps, err := AlertRuleFromK8s(src.OrgID, k8sRule, src.Version)
	require.NoError(t, err)
	assert.Equal(t, managerProps, gotManagerProps)
	assertRoundTrip(t, src, got, "Record")
}

func TestRecordingRuleFromK8sRoundTrip(t *testing.T) {
	src := roundTripSource(t)
	src.Record = &ngmodels.Record{Metric: "job:up:sum", From: src.Data[0].RefID, TargetDatasourceUID: "prom"}
	for field := range notInRecordingRuleSpec {
		reflect.ValueOf(src).Elem().FieldByName(field).SetZero()
	}
	src.K8sStatus = mustMarshal(t, v1beta1.RecordingRuleStatus{LastError: new("boom")})
	managerProps := utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "tf"}

	k8sRule, err := RecordingRuleToK8s(src.OrgID, src, managerProps, nsMapperForTest())
	require.NoError(t, err)

	got, gotManagerProps, err := RecordingRuleFromK8s(src.OrgID, k8sRule, src.Version)
	require.NoError(t, err)
	assert.Equal(t, managerProps, gotManagerProps)

	skip := make([]string, 0, len(notInRecordingRuleSpec))
	for field := range notInRecordingRuleSpec {
		skip = append(skip, field)
	}
	assertRoundTrip(t, src, got, skip...)
}

func TestAlertRuleFromK8sStorageManagedFields(t *testing.T) {
	created := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	newRule := func(t *testing.T) *v1beta1.AlertRule {
		src := roundTripSource(t)
		src.Record = nil
		src.Condition = src.Data[0].RefID
		k8sRule, err := AlertRuleToK8s(src.OrgID, src, utils.ManagerProperties{}, nsMapperForTest())
		require.NoError(t, err)
		return k8sRule
	}

	t.Run("never-updated object falls back to creation metadata", func(t *testing.T) {
		k8sRule := newRule(t)
		meta, err := utils.MetaAccessor(k8sRule)
		require.NoError(t, err)
		meta.SetUpdatedTimestamp(nil)
		meta.SetUpdatedBy("")
		meta.SetCreatedBy("user:creator")
		k8sRule.CreationTimestamp = metav1.NewTime(created)

		got, _, err := AlertRuleFromK8s(1, k8sRule, 1)
		require.NoError(t, err)
		assert.True(t, created.Equal(got.Updated), "got %s", got.Updated)
		require.NotNil(t, got.UpdatedBy)
		assert.Equal(t, ngmodels.UserUID("user:creator"), *got.UpdatedBy)
	})

	t.Run("unknown author leaves UpdatedBy nil", func(t *testing.T) {
		k8sRule := newRule(t)
		meta, err := utils.MetaAccessor(k8sRule)
		require.NoError(t, err)
		meta.SetUpdatedBy("")

		got, _, err := AlertRuleFromK8s(1, k8sRule, 1)
		require.NoError(t, err)
		assert.Nil(t, got.UpdatedBy)
	})

	t.Run("empty status leaves K8sStatus nil", func(t *testing.T) {
		k8sRule := newRule(t)
		k8sRule.Status = v1beta1.AlertRuleStatus{}

		got, _, err := AlertRuleFromK8s(1, k8sRule, 1)
		require.NoError(t, err)
		assert.Nil(t, got.K8sStatus)
	})

	t.Run("version is the one the caller passes", func(t *testing.T) {
		k8sRule := newRule(t)
		k8sRule.ResourceVersion = "123"
		k8sRule.Generation = 7

		got, _, err := AlertRuleFromK8s(1, k8sRule, 42)
		require.NoError(t, err)
		assert.Equal(t, int64(42), got.Version)
	})
}

// roundTripSource returns a rule with every field the converters carry set to a non-zero value. Values
// are normalised to what the k8s representation can hold: timestamps to whole seconds in UTC, and the
// query model to compact JSON.
func roundTripSource(t *testing.T) *ngmodels.AlertRule {
	t.Helper()
	gen := ngmodels.RuleGen
	rule := gen.With(gen.WithOrgID(1)).GenerateRef()

	rule.ID = 0
	rule.FolderFullpath = ""
	rule.GUID = "a1b2c3d4-guid"
	rule.Version = 9
	rule.Updated = time.Date(2026, 11, 17, 10, 11, 12, 0, time.UTC)
	rule.UpdatedBy = new(ngmodels.UserUID("user:editor"))
	rule.IsPaused = true
	rule.RuleGroup = "group-a"
	rule.RuleGroupIndex = 2
	rule.IntervalSeconds = 60
	rule.Labels = map[string]string{"team": "alerting"}
	// EditorSettings has no field in the k8s spec; only PrometheusStyleRule is carried.
	rule.Metadata = ngmodels.AlertRuleMetadata{
		PrometheusStyleRule: &ngmodels.PrometheusStyleRule{OriginalRuleDefinition: "expr: up\n"},
	}
	rule.Data = rule.Data[:1]
	rule.Data[0].RefID = "A"
	rule.Data[0].Model = json.RawMessage(`{"expr":"up","refId":"A"}`)
	rule.Data[0].QueryType = "range"
	rule.Data[0].DatasourceUID = "prom"
	rule.Data[0].RelativeTimeRange = ngmodels.RelativeTimeRange{
		From: ngmodels.Duration(10 * time.Minute),
		To:   ngmodels.Duration(time.Minute),
	}
	return rule
}

func assertRoundTrip(t *testing.T, src, got *ngmodels.AlertRule, notApplicable ...string) {
	t.Helper()
	skip := make(map[string]bool, len(notRoundTripped)+len(notApplicable))
	for field := range notRoundTripped {
		skip[field] = true
	}
	for _, field := range notApplicable {
		skip[field] = true
	}

	srcV, gotV := reflect.ValueOf(*src), reflect.ValueOf(*got)
	typ := srcV.Type()
	for i := range typ.NumField() {
		field := typ.Field(i)
		if !field.IsExported() || skip[field.Name] {
			continue
		}
		require.Falsef(t, srcV.Field(i).IsZero(), "source field %s is zero: set it so the round-trip covers it, or list it in notRoundTripped", field.Name)
		assert.Equalf(t, srcV.Field(i).Interface(), gotV.Field(i).Interface(), "field %s did not round-trip", field.Name)
	}
}

func mustMarshal(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return b
}
