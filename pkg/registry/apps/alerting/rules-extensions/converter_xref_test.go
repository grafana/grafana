package rulesextensions

import (
	"encoding/json"
	"sort"
	"strings"
	"testing"
	"time"

	prom_model "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	rulesextv0 "github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/apis/rulesextensions/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/app/prometheusrulefile"
	alertingv0 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/services/datasources"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
)

// These tests run the same Prometheus rule input through two pipelines:
//
//  1. The rules-extensions Converter (which the PrometheusRuleFile reconciler uses)
//     produces a k8s AlertRule / RecordingRule. We then run that k8s object through the
//     legacy storage compat layer's ConvertToDomainModel to land in ngmodels.AlertRule.
//
//  2. The Prometheus → Grafana converter (pkg/services/ngalert/prom) — the same engine
//     behind the /api/v1/provisioning/convert/prometheus HTTP API — produces an
//     ngmodels.AlertRule directly.
//
// Both pipelines must produce semantically identical domain rules. This test catches any
// drift between the two implementations of the same Prometheus rule semantics.

const (
	testOrgID        = int64(7)
	testNamespaceUID = "folder-uid-1"
	testDatasourceID = "ds-prom-1"
	testGroupName    = "service-A"
	testEvalInterval = time.Minute
)

func TestConverterMatchesPromConverter_AlertingRule(t *testing.T) {
	forD := prom_model.Duration(5 * time.Minute)
	keepFiringForD := prom_model.Duration(10 * time.Minute)
	promRule := prom.PrometheusRule{
		Alert:         "HighRequestRate",
		Expr:          `sum(rate(http_requests_total{job="api"}[5m])) > 100`,
		For:           &forD,
		KeepFiringFor: &keepFiringForD,
		Labels:        map[string]string{"severity": "critical", "team": "core"},
		Annotations:   map[string]string{"summary": "high request rate", "runbook": "https://example.com/rb"},
	}
	promGroup := prom.PrometheusRuleGroup{
		Name:     testGroupName,
		Interval: prom_model.Duration(testEvalInterval),
		Rules:    []prom.PrometheusRule{promRule},
		Labels:   map[string]string{"env": "prod"},
	}

	// Pipeline 1: rules-extensions converter → k8s AlertRule → compat → domain.
	rxDomain := rulesExtensionsAlertDomainRule(t, promGroup, promRule)

	// Pipeline 2: prom converter → domain.
	promDomain := promConvertAlerting(t, promGroup)

	assertAlertRuleSemanticallyEqual(t, promDomain, rxDomain)
}

func TestConverterMatchesPromConverter_AlertingRule_QueryOffset(t *testing.T) {
	queryOffset := prom_model.Duration(30 * time.Second)
	promRule := prom.PrometheusRule{
		Alert:  "UpZero",
		Expr:   "up == 0",
		Labels: map[string]string{"severity": "page"},
	}
	promGroup := prom.PrometheusRuleGroup{
		Name:        testGroupName,
		Interval:    prom_model.Duration(testEvalInterval),
		QueryOffset: &queryOffset,
		Rules:       []prom.PrometheusRule{promRule},
	}
	rxDomain := rulesExtensionsAlertDomainRule(t, promGroup, promRule)
	promDomain := promConvertAlerting(t, promGroup)
	assertAlertRuleSemanticallyEqual(t, promDomain, rxDomain)
}

func TestConverterMatchesPromConverter_RecordingRule(t *testing.T) {
	promRule := prom.PrometheusRule{
		Record: "http_request_rate:sum",
		Expr:   `sum(rate(http_requests_total[1m]))`,
		Labels: map[string]string{"team": "core"},
	}
	promGroup := prom.PrometheusRuleGroup{
		Name:     testGroupName,
		Interval: prom_model.Duration(testEvalInterval),
		Rules:    []prom.PrometheusRule{promRule},
		Labels:   map[string]string{"env": "prod"},
	}

	rxDomain := rulesExtensionsRecordingDomainRule(t, promGroup, promRule)
	promDomain := promConvertRecording(t, promGroup)
	assertAlertRuleSemanticallyEqual(t, promDomain, rxDomain)
}

// --- pipeline 1 helpers (rules-extensions converter → k8s → domain) ---

func rulesExtensionsAlertDomainRule(t *testing.T, promGroup prom.PrometheusRuleGroup, promRule prom.PrometheusRule) *ngmodels.AlertRule {
	t.Helper()
	c := newRulesExtensionsConverter()
	rxGroup, rxRule := toRulesExtensionsAlerting(promGroup, promRule)

	spec, err := c.BuildAlertRuleSpec(rxGroup, rxRule)
	require.NoError(t, err)

	// Wrap in a k8s AlertRule the same way the reconciler would. Use a deterministic name
	// so it survives the compat conversion (which carries it through to UID).
	k8sRule := &alertingv0.AlertRule{
		ObjectMeta: metav1.ObjectMeta{Name: "rx-alert", Namespace: "default"},
		Spec:       spec,
	}
	k8sRule.SetGroupVersionKind(alertingv0.GroupVersion.WithKind("AlertRule"))

	// Round-trip through the legacy storage compat layer, which is the same path a writer
	// would hit when persisting to the legacy AlertRule store.
	domain, _, err := alertrule.ConvertToDomainModel(testOrgID, k8sRule)
	require.NoError(t, err)
	return domain
}

func rulesExtensionsRecordingDomainRule(t *testing.T, promGroup prom.PrometheusRuleGroup, promRule prom.PrometheusRule) *ngmodels.AlertRule {
	t.Helper()
	c := newRulesExtensionsConverter()
	rxGroup, rxRule := toRulesExtensionsRecording(promGroup, promRule)

	spec, err := c.BuildRecordingRuleSpec(rxGroup, rxRule)
	require.NoError(t, err)

	k8sRule := &alertingv0.RecordingRule{
		ObjectMeta: metav1.ObjectMeta{Name: "rx-rec", Namespace: "default"},
		Spec:       spec,
	}
	k8sRule.SetGroupVersionKind(alertingv0.GroupVersion.WithKind("RecordingRule"))

	domain, _, err := recordingrule.ConvertToDomainModel(testOrgID, k8sRule)
	require.NoError(t, err)
	return domain
}

func newRulesExtensionsConverter() *prometheusrulefile.Converter {
	return prometheusrulefile.NewConverter(prometheusrulefile.ConverterConfig{
		DatasourceUID:   testDatasourceID,
		DatasourceType:  datasources.DS_PROMETHEUS,
		DefaultInterval: testEvalInterval,
		// Match the prom converter's defaultConfig so both pipelines start from the same
		// baseline. The two-implementation drift test would lose its value if we picked
		// different defaults.
		FromTimeRange:    600 * time.Second,
		EvaluationOffset: 0,
		NoDataState:      alertingv0.AlertRuleNoDataStateOk,
		ExecErrState:     alertingv0.AlertRuleExecErrStateOk,
	})
}

func toRulesExtensionsAlerting(g prom.PrometheusRuleGroup, r prom.PrometheusRule) (rulesextv0.PrometheusRuleFilePrometheusRuleGroup, rulesextv0.PrometheusRuleFileRuleEntry) {
	rxGroup := rulesextv0.PrometheusRuleFilePrometheusRuleGroup{
		Name:   g.Name,
		Labels: g.Labels,
	}
	if time.Duration(g.Interval) > 0 {
		d := rulesextv0.PrometheusRuleFilePromDuration(time.Duration(g.Interval).String())
		rxGroup.Interval = &d
	}
	if g.QueryOffset != nil {
		d := rulesextv0.PrometheusRuleFilePromDuration(time.Duration(*g.QueryOffset).String())
		rxGroup.QueryOffset = &d
	}

	rxRule := rulesextv0.PrometheusRuleFileRuleEntry{
		Alert:       &r.Alert,
		Expr:        r.Expr,
		Labels:      r.Labels,
		Annotations: r.Annotations,
	}
	if r.For != nil {
		d := rulesextv0.PrometheusRuleFilePromDuration(time.Duration(*r.For).String())
		rxRule.For = &d
	}
	if r.KeepFiringFor != nil {
		d := rulesextv0.PrometheusRuleFilePromDuration(time.Duration(*r.KeepFiringFor).String())
		rxRule.KeepFiringFor = &d
	}
	return rxGroup, rxRule
}

func toRulesExtensionsRecording(g prom.PrometheusRuleGroup, r prom.PrometheusRule) (rulesextv0.PrometheusRuleFilePrometheusRuleGroup, rulesextv0.PrometheusRuleFileRuleEntry) {
	rxGroup, _ := toRulesExtensionsAlerting(g, prom.PrometheusRule{})
	rxRule := rulesextv0.PrometheusRuleFileRuleEntry{
		Record: &r.Record,
		Expr:   r.Expr,
		Labels: r.Labels,
	}
	return rxGroup, rxRule
}

// --- pipeline 2 helpers (prom converter → domain) ---

func promConvertAlerting(t *testing.T, promGroup prom.PrometheusRuleGroup) *ngmodels.AlertRule {
	t.Helper()
	return runPromConverter(t, promGroup)
}

func promConvertRecording(t *testing.T, promGroup prom.PrometheusRuleGroup) *ngmodels.AlertRule {
	t.Helper()
	return runPromConverter(t, promGroup)
}

func runPromConverter(t *testing.T, promGroup prom.PrometheusRuleGroup) *ngmodels.AlertRule {
	t.Helper()
	keepOrig := false
	conv, err := prom.NewConverter(prom.Config{
		DatasourceUID:              testDatasourceID,
		DatasourceType:             datasources.DS_PROMETHEUS,
		TargetDatasourceUID:        testDatasourceID,
		TargetDatasourceType:       datasources.DS_PROMETHEUS,
		DefaultInterval:            testEvalInterval,
		KeepOriginalRuleDefinition: &keepOrig, // exclude the YAML blob; we compare semantics, not provenance metadata
	})
	require.NoError(t, err)
	group, err := conv.PrometheusRulesToGrafana(testOrgID, testNamespaceUID, promGroup)
	require.NoError(t, err)
	require.Len(t, group.Rules, 1)
	return &group.Rules[0]
}

// --- assertion helpers ---

// assertAlertRuleSemanticallyEqual compares the parts of two domain AlertRules that are
// under the control of the two converters. Fields driven by ambient state (UID generation,
// NamespaceUID, RuleGroup name, OrgID, IntervalSeconds wiring, etc.) are excluded — those
// come from the reconciler or the convert API caller, not from the per-rule conversion.
//
// A handful of representational differences are normalized:
//
//   - NoDataState / ExecErrState are compared case-insensitively. The k8s AlertRule schema
//     pins the values to "Ok" while the ngmodels domain constant is "OK"; both encode the
//     same alert behavior. The rules-extensions converter must emit the schema-valid form.
//   - Annotations: prom converter leaves the field nil when a rule has none, while the
//     compat layer always initializes an empty map. Treat (nil) and (map[]) as equal.
//   - Condition: irrelevant for recording rules (no Condition field on RecordingRule's
//     k8s schema), so the assertion is skipped when Record is set.
func assertAlertRuleSemanticallyEqual(t *testing.T, want, got *ngmodels.AlertRule) {
	t.Helper()
	isRecordingRule := want.Record != nil || got.Record != nil

	assert.Equal(t, want.Title, got.Title, "Title")
	if !isRecordingRule {
		// NoDataState / ExecErrState are alerting-only concerns. The prom converter still
		// populates them on the ngmodels.AlertRule for recording rules (they're shared
		// fields on the domain type), but the k8s RecordingRule schema has no slot for
		// them so the rules-extensions roundtrip drops them. Comparing them on recording
		// rules would always fail, and the divergence is intentional.
		assert.Equal(t, strings.ToLower(string(want.NoDataState)), strings.ToLower(string(got.NoDataState)), "NoDataState (case-insensitive)")
		assert.Equal(t, strings.ToLower(string(want.ExecErrState)), strings.ToLower(string(got.ExecErrState)), "ExecErrState (case-insensitive)")
	}
	assert.Equal(t, want.For, got.For, "For")
	assert.Equal(t, want.KeepFiringFor, got.KeepFiringFor, "KeepFiringFor")
	assert.Equal(t, want.IsPaused, got.IsPaused, "IsPaused")

	// MissingSeriesEvalsToResolve: prom converter sets it to *int64(1) for alerting rules
	// and leaves it nil for recording rules. The rules-extensions converter mirrors this.
	assert.Equal(t, want.MissingSeriesEvalsToResolve, got.MissingSeriesEvalsToResolve, "MissingSeriesEvalsToResolve")

	// Labels: the prom converter additionally injects ConvertedPrometheusRuleLabel="true".
	// Our rules-extensions converter doesn't (the file already encodes its provenance via
	// the parent PrometheusRuleFile). Compare label maps modulo that marker.
	wantLabels := stripLabel(want.Labels, ngmodels.ConvertedPrometheusRuleLabel)
	assert.Equal(t, normalizeMap(wantLabels), normalizeMap(got.Labels), "Labels (excluding %s)", ngmodels.ConvertedPrometheusRuleLabel)

	assert.Equal(t, normalizeMap(want.Annotations), normalizeMap(got.Annotations), "Annotations")

	// Record (recording rules only).
	if want.Record != nil || got.Record != nil {
		require.NotNil(t, want.Record, "want.Record")
		require.NotNil(t, got.Record, "got.Record")
		assert.Equal(t, want.Record.Metric, got.Record.Metric, "Record.Metric")
		assert.Equal(t, want.Record.TargetDatasourceUID, got.Record.TargetDatasourceUID, "Record.TargetDatasourceUID")
		assert.Equal(t, want.Record.From, got.Record.From, "Record.From (source refID)")
	} else {
		// Condition refID applies only to alerting rules — for recording rules, the k8s
		// RecordingRule type has no Condition field so the compat-layer roundtrip drops it.
		assert.Equal(t, want.Condition, got.Condition, "Condition")
	}

	assertQueriesSemanticallyEqual(t, want.Data, got.Data)
}

// normalizeMap returns nil for an empty or nil map so callers can compare the two forms as
// equal. The compat layer always allocates `Annotations: make(map[string]string)` even when
// the rule has no annotations, while the prom converter passes the rule's annotations
// through verbatim (which may be nil).
func normalizeMap(m map[string]string) map[string]string {
	if len(m) == 0 {
		return nil
	}
	return m
}

func assertQueriesSemanticallyEqual(t *testing.T, want, got []ngmodels.AlertQuery) {
	t.Helper()
	require.Equal(t, len(want), len(got), "number of query nodes")

	// Sort by RefID so map-iteration-order differences in the rules-extensions
	// ExpressionMap path don't affect comparison.
	sort.Slice(want, func(i, j int) bool { return want[i].RefID < want[j].RefID })
	sort.Slice(got, func(i, j int) bool { return got[i].RefID < got[j].RefID })

	for i := range want {
		assert.Equal(t, want[i].RefID, got[i].RefID, "query[%d].RefID", i)
		assert.Equal(t, want[i].DatasourceUID, got[i].DatasourceUID, "query[%d].DatasourceUID", i)
		assert.Equal(t, want[i].QueryType, got[i].QueryType, "query[%d].QueryType", i)
		assert.Equal(t, want[i].RelativeTimeRange, got[i].RelativeTimeRange, "query[%d].RelativeTimeRange", i)

		// Compare the model JSON semantically rather than byte-wise. Both pipelines emit
		// JSON-equivalent payloads, but key ordering and the prom converter's verbose
		// embedded datasource struct (vs. our minimal {type, uid}) would defeat a literal
		// comparison. We only assert on the keys that drive alert evaluation.
		assertQueryModelEquivalent(t, want[i].Model, got[i].Model, want[i].RefID)
	}
}

func assertQueryModelEquivalent(t *testing.T, want, got json.RawMessage, refID string) {
	t.Helper()
	wantM := decodeModel(t, want)
	gotM := decodeModel(t, got)

	// Datasource: only `type` and `uid` matter for alert evaluation; the prom converter
	// happens to embed the full datasources.DataSource struct, while the rules-extensions
	// converter writes the minimal pair. Normalize both before comparing.
	assert.Equal(t, datasourceTypeUID(wantM), datasourceTypeUID(gotM), "model.datasource (type+uid) for refID=%s", refID)
	delete(wantM, "datasource")
	delete(gotM, "datasource")

	// `refId` and `type` are the structural anchors — must match.
	assert.Equal(t, wantM["refId"], gotM["refId"], "model.refId for refID=%s", refID)
	assert.Equal(t, wantM["type"], gotM["type"], "model.type for refID=%s", refID)
	delete(wantM, "refId")
	delete(gotM, "refId")
	delete(wantM, "type")
	delete(gotM, "type")

	// Compare the remainder verbatim. This covers `expr`, `instant`, `range`,
	// `queryType` (Loki), `expression`, `conditions`, etc.
	assert.Equal(t, wantM, gotM, "model body for refID=%s", refID)
}

func datasourceTypeUID(m map[string]any) (out map[string]any) {
	ds, ok := m["datasource"].(map[string]any)
	if !ok {
		return nil
	}
	return map[string]any{
		"type": ds["type"],
		"uid":  ds["uid"],
	}
}

func decodeModel(t *testing.T, raw json.RawMessage) map[string]any {
	t.Helper()
	if len(raw) == 0 {
		return nil
	}
	var m map[string]any
	require.NoError(t, json.Unmarshal(raw, &m))
	return m
}

func stripLabel(in map[string]string, key string) map[string]string {
	out := make(map[string]string, len(in))
	for k, v := range in {
		if k == key {
			continue
		}
		out[k] = v
	}
	return out
}
