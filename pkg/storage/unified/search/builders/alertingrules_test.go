package builders

import (
	"context"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	rulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	rulesmanifest "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// rulesManifests is the rule kinds' manifest; the tests derive the rule search
// fields from it the way the shared registry does in production.
var rulesManifests = []app.Manifest{rulesmanifest.LocalManifest()}

var rulesSearchFieldsProvider = resource.NewManifestBackedProvider(rulesManifests)

// Field names as declared in apps/alerting/rules/kinds/{alertRule,recordingRule}.cue.
// Only type, labels, annotations and datasourceUIDs remain as Go constants in
// the builder (they are computed); the rest live only in the manifest, so the
// tests reference them here by name.
const (
	testFieldInterval            = "interval"
	testFieldPaused              = "paused"
	testFieldFor                 = "for"
	testFieldKeepFiringFor       = "keepFiringFor"
	testFieldDashboardUID        = "dashboardUID"
	testFieldPanelID             = "panelID"
	testFieldReceiver            = "receiver"
	testFieldNotificationType    = "notificationType"
	testFieldRoutingTree         = "routingTree"
	testFieldMetric              = "metric"
	testFieldTargetDatasourceUID = "targetDatasourceUID"
)

func alertRuleKey(name string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "rules.alerting.grafana.app",
		Resource:  "alertrules",
		Name:      name,
	}
}

func recordingRuleKey(name string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "rules.alerting.grafana.app",
		Resource:  "recordingrules",
		Name:      name,
	}
}

// rulesTestRegistry seeds a registry with the rule kinds' fields so the
// registry-backed builders extract them, as they do in production.
func rulesTestRegistry(t *testing.T) *resource.SearchFieldsRegistry {
	t.Helper()
	sel, hashes, providers, err := resource.SearchFieldsForManifests(rulesManifests)
	require.NoError(t, err)
	return resource.NewSearchFieldsRegistry(sel, hashes, providers)
}

func buildAlertRuleDoc(t *testing.T, value string) *resource.IndexableDocument {
	t.Helper()
	info, err := GetAlertRuleSearchBuilder(rulesTestRegistry(t))
	require.NoError(t, err)
	doc, err := info.Builder.BuildDocument(context.Background(), alertRuleKey("r1"), 1, []byte(value))
	require.NoError(t, err)
	return doc
}

func buildRecordingRuleDoc(t *testing.T, value string) *resource.IndexableDocument {
	t.Helper()
	info, err := GetRecordingRuleSearchBuilder(rulesTestRegistry(t))
	require.NoError(t, err)
	doc, err := info.Builder.BuildDocument(context.Background(), recordingRuleKey("r1"), 1, []byte(value))
	require.NoError(t, err)
	return doc
}

func TestAlertRuleBuilder_extracts_declared_path_fields(t *testing.T) {
	doc := buildAlertRuleDoc(t, `{
		"apiVersion": "rules.alerting.grafana.app/v0alpha1",
		"kind": "AlertRule",
		"metadata": {"name": "r1"},
		"spec": {
			"trigger": {"interval": "1m"},
			"paused": true,
			"for": "5m",
			"keepFiringFor": "2m",
			"panelRef": {"dashboardUID": "dash-1", "panelID": 42},
			"notificationSettings": {"type": "SimplifiedRouting", "receiver": "team-a"},
			"expressions": {},
			"title": "My rule"
		}
	}`)

	assert.Equal(t, "1m", doc.Fields[testFieldInterval])
	assert.Equal(t, true, doc.Fields[testFieldPaused])
	assert.Equal(t, "5m", doc.Fields[testFieldFor])
	assert.Equal(t, "2m", doc.Fields[testFieldKeepFiringFor])
	assert.Equal(t, "dash-1", doc.Fields[testFieldDashboardUID])
	assert.Equal(t, int64(42), doc.Fields[testFieldPanelID])
	assert.Equal(t, "team-a", doc.Fields[testFieldReceiver])
}

func TestAlertRuleBuilder_computes_type_and_extracts_notification_type(t *testing.T) {
	simplified := buildAlertRuleDoc(t, `{
		"apiVersion": "rules.alerting.grafana.app/v0alpha1",
		"kind": "AlertRule",
		"metadata": {"name": "r1"},
		"spec": {"trigger": {"interval": "1m"}, "expressions": {},
			"notificationSettings": {"type": "SimplifiedRouting", "receiver": "team-a"}}
	}`)
	assert.Equal(t, "alertrule", simplified.Fields[ruleSearchType])
	assert.Equal(t, "SimplifiedRouting", simplified.Fields[testFieldNotificationType])
	assert.Equal(t, "team-a", simplified.Fields[testFieldReceiver])
	assert.NotContains(t, simplified.Fields, testFieldRoutingTree)

	named := buildAlertRuleDoc(t, `{
		"apiVersion": "rules.alerting.grafana.app/v0alpha1",
		"kind": "AlertRule",
		"metadata": {"name": "r1"},
		"spec": {"trigger": {"interval": "1m"}, "expressions": {},
			"notificationSettings": {"type": "NamedRoutingTree", "routingTree": "tree-1"}}
	}`)
	assert.Equal(t, "NamedRoutingTree", named.Fields[testFieldNotificationType])
	assert.Equal(t, "tree-1", named.Fields[testFieldRoutingTree])
	assert.NotContains(t, named.Fields, testFieldReceiver)
}

func TestAlertRuleBuilder_omits_absent_optional_fields(t *testing.T) {
	doc := buildAlertRuleDoc(t, `{
		"apiVersion": "rules.alerting.grafana.app/v0alpha1",
		"kind": "AlertRule",
		"metadata": {"name": "r1"},
		"spec": {"trigger": {"interval": "1m"}, "expressions": {}}
	}`)

	// paused does not declare emitZeroIfAbsent, so a missing value leaves the
	// field absent rather than indexing a spurious false.
	assert.NotContains(t, doc.Fields, testFieldPaused)
	assert.NotContains(t, doc.Fields, testFieldFor)
	assert.NotContains(t, doc.Fields, testFieldKeepFiringFor)
	assert.NotContains(t, doc.Fields, testFieldDashboardUID)
	assert.NotContains(t, doc.Fields, testFieldPanelID)
	assert.NotContains(t, doc.Fields, testFieldReceiver)
	assert.NotContains(t, doc.Fields, testFieldNotificationType)
	assert.NotContains(t, doc.Fields, ruleSearchAnnotations)
	assert.NotContains(t, doc.Fields, ruleSearchLabels)
	assert.NotContains(t, doc.Fields, ruleSearchDatasourceUIDs)
}

func TestAlertRuleBuilder_flattens_labels(t *testing.T) {
	doc := buildAlertRuleDoc(t, `{
		"apiVersion": "rules.alerting.grafana.app/v0alpha1",
		"kind": "AlertRule",
		"metadata": {"name": "r1"},
		"spec": {"trigger": {"interval": "1m"}, "expressions": {},
			"labels": {"severity": "critical"}}
	}`)

	labels, ok := doc.Fields[ruleSearchLabels].([]string)
	require.True(t, ok, "labels should be []string, got %T", doc.Fields[ruleSearchLabels])
	assert.ElementsMatch(t, []string{"severity", "severity=critical"}, labels)
}

func TestAlertRuleBuilder_encodes_annotations_as_json(t *testing.T) {
	doc := buildAlertRuleDoc(t, `{
		"apiVersion": "rules.alerting.grafana.app/v0alpha1",
		"kind": "AlertRule",
		"metadata": {"name": "r1"},
		"spec": {"trigger": {"interval": "1m"}, "expressions": {},
			"annotations": {"summary": "boom"}}
	}`)

	assert.JSONEq(t, `{"summary":"boom"}`, doc.Fields[ruleSearchAnnotations].(string))
}

func TestAlertRuleBuilder_datasourceUIDs_excludes_expression_ds_and_dedups(t *testing.T) {
	doc := buildAlertRuleDoc(t, `{
		"apiVersion": "rules.alerting.grafana.app/v0alpha1",
		"kind": "AlertRule",
		"metadata": {"name": "r1"},
		"spec": {"trigger": {"interval": "1m"}, "expressions": {
			"A": {"datasourceUID": "ds-prom", "model": {}},
			"B": {"datasourceUID": "ds-loki", "model": {}},
			"C": {"datasourceUID": "ds-prom", "model": {}},
			"D": {"datasourceUID": "`+expr.DatasourceUID+`", "model": {}}
		}}
	}`)

	uids, ok := doc.Fields[ruleSearchDatasourceUIDs].([]string)
	require.True(t, ok, "datasourceUIDs should be []string, got %T", doc.Fields[ruleSearchDatasourceUIDs])
	// ds-prom is deduplicated, the expression datasource is excluded, and the
	// result is sorted for a stable index document.
	assert.Equal(t, []string{"ds-loki", "ds-prom"}, uids)
}

func TestRecordingRuleBuilder_extracts_and_computes_fields(t *testing.T) {
	doc := buildRecordingRuleDoc(t, `{
		"apiVersion": "rules.alerting.grafana.app/v0alpha1",
		"kind": "RecordingRule",
		"metadata": {"name": "r1"},
		"spec": {
			"trigger": {"interval": "30s"},
			"paused": false,
			"metric": "my_metric",
			"targetDatasourceUID": "ds-target",
			"labels": {"team": "obs"},
			"expressions": {
				"A": {"datasourceUID": "ds-prom", "model": {}},
				"B": {"datasourceUID": "`+expr.OldDatasourceUID+`", "model": {}}
			}
		}
	}`)

	assert.Equal(t, "recordingrule", doc.Fields[ruleSearchType])
	assert.Equal(t, "30s", doc.Fields[testFieldInterval])
	assert.Equal(t, false, doc.Fields[testFieldPaused])
	assert.Equal(t, "my_metric", doc.Fields[testFieldMetric])
	assert.Equal(t, "ds-target", doc.Fields[testFieldTargetDatasourceUID])
	assert.Equal(t, []string{"ds-prom"}, doc.Fields[ruleSearchDatasourceUIDs])
	assert.ElementsMatch(t, []string{"team", "team=obs"}, doc.Fields[ruleSearchLabels])
}

// TestRuleSearchFields_derivedFromManifest verifies the rule kinds' manifest
// declares the search fields and that the column-definition view derived from
// them (the same view the search backend uses) matches the declared types and
// capabilities.
func TestRuleSearchFields_derivedFromManifest(t *testing.T) {
	info, err := GetAlertRuleSearchBuilder(nil)
	require.NoError(t, err)

	gvr := schema.GroupVersionResource{
		Group:    info.GroupResource.Group,
		Version:  rulesv0alpha1.AlertRuleKind().GroupVersionResource().Version,
		Resource: info.GroupResource.Resource,
	}
	fields := rulesSearchFieldsProvider.Fields(gvr)
	require.NotEmpty(t, fields, "alert rule search fields should be declared in the manifest")

	cols := resource.SearchFieldDefinitionsToTableColumns(fields)
	byName := make(map[string]*resourcepb.ResourceTableColumnDefinition, len(cols))
	for _, c := range cols {
		byName[c.Name] = c
	}

	// A path-declared string filter field.
	interval := byName[testFieldInterval]
	require.NotNil(t, interval)
	assert.Equal(t, resourcepb.ResourceTableColumnDefinition_STRING, interval.Type)

	// Boolean field.
	paused := byName[testFieldPaused]
	require.NotNil(t, paused)
	assert.Equal(t, resourcepb.ResourceTableColumnDefinition_BOOLEAN, paused.Type)

	// Int64 field.
	panelID := byName[testFieldPanelID]
	require.NotNil(t, panelID)
	assert.Equal(t, resourcepb.ResourceTableColumnDefinition_INT64, panelID.Type)

	// Array field carries IsArray.
	labels := byName[ruleSearchLabels]
	require.NotNil(t, labels)
	assert.True(t, labels.IsArray)
}

// TestRuleSearchFields_hashDiffersPerKind verifies the manifest declares a
// non-empty search-fields hash for each rule kind and that the two kinds differ.
func TestRuleSearchFields_hashDiffersPerKind(t *testing.T) {
	alertInfo, err := GetAlertRuleSearchBuilder(nil)
	require.NoError(t, err)

	recordingInfo, err := GetRecordingRuleSearchBuilder(nil)
	require.NoError(t, err)

	alertHash := rulesSearchFieldsProvider.IndexAffectingHash(alertInfo.GroupResource.Group, alertInfo.GroupResource.Resource)
	recordingHash := rulesSearchFieldsProvider.IndexAffectingHash(recordingInfo.GroupResource.Group, recordingInfo.GroupResource.Resource)
	assert.NotEmpty(t, alertHash)
	assert.NotEmpty(t, recordingHash)

	// The two kinds declare different fields, so their hashes must differ.
	assert.NotEqual(t, alertHash, recordingHash)
}
