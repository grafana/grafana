package builders

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"

	rulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Rule search field/column names. These must match the keys the alerting rule
// search handler uses when building ResourceSearchRequests so the legacy and
// unified backends are interchangeable. Group is intentionally not a column: it
// is a known label key matched via IndexableDocument.Labels.
const (
	ruleSearchType                = "type"
	ruleSearchPaused              = "paused"
	ruleSearchLabels              = "labels"
	ruleSearchDatasourceUIDs      = "datasourceUIDs"
	ruleSearchDashboardUID        = "dashboardUID"
	ruleSearchPanelID             = "panelID"
	ruleSearchMetric              = "metric"
	ruleSearchTargetDatasourceUID = "targetDatasourceUID"
)

func ruleSearchColumnDefinitions() []*resourcepb.ResourceTableColumnDefinition {
	filterable := &resourcepb.ResourceTableColumnDefinition_Properties{Filterable: true}
	return []*resourcepb.ResourceTableColumnDefinition{
		{Name: ruleSearchType, Type: resourcepb.ResourceTableColumnDefinition_STRING, Properties: filterable},
		{Name: ruleSearchPaused, Type: resourcepb.ResourceTableColumnDefinition_BOOLEAN, Properties: filterable},
		// The rule's own (spec) labels, indexed as "key" and "key=value" terms
		// so label matchers (equals and existence) resolve against them.
		{Name: ruleSearchLabels, Type: resourcepb.ResourceTableColumnDefinition_STRING, IsArray: true, Properties: filterable},
		{Name: ruleSearchDatasourceUIDs, Type: resourcepb.ResourceTableColumnDefinition_STRING, IsArray: true, Properties: filterable},
		{Name: ruleSearchDashboardUID, Type: resourcepb.ResourceTableColumnDefinition_STRING, Properties: filterable},
		{Name: ruleSearchPanelID, Type: resourcepb.ResourceTableColumnDefinition_INT64, Properties: filterable},
		{Name: ruleSearchMetric, Type: resourcepb.ResourceTableColumnDefinition_STRING, Properties: filterable},
		{Name: ruleSearchTargetDatasourceUID, Type: resourcepb.ResourceTableColumnDefinition_STRING, Properties: filterable},
	}
}

// serverSideDatasourceUIDs are synthetic expression datasources, never a
// user-facing query datasource.
var serverSideDatasourceUIDs = map[string]struct{}{
	expr.DatasourceUID:    {},
	expr.OldDatasourceUID: {},
	expr.MLDatasourceUID:  {},
}

func GetAlertRuleSearchBuilder() (resource.DocumentBuilderInfo, error) {
	fields, err := resource.NewSearchableDocumentFields(ruleSearchColumnDefinitions())
	return resource.DocumentBuilderInfo{
		GroupResource: schema.GroupResource{Group: rulesv0alpha1.AlertRuleKind().Group(), Resource: rulesv0alpha1.AlertRuleKind().Plural()},
		Fields:        fields,
		Builder:       new(alertRuleSearchBuilder),
	}, err
}

func GetRecordingRuleSearchBuilder() (resource.DocumentBuilderInfo, error) {
	fields, err := resource.NewSearchableDocumentFields(ruleSearchColumnDefinitions())
	return resource.DocumentBuilderInfo{
		GroupResource: schema.GroupResource{Group: rulesv0alpha1.RecordingRuleKind().Group(), Resource: rulesv0alpha1.RecordingRuleKind().Plural()},
		Fields:        fields,
		Builder:       new(recordingRuleSearchBuilder),
	}, err
}

var (
	_ resource.DocumentBuilder = new(alertRuleSearchBuilder)
	_ resource.DocumentBuilder = new(recordingRuleSearchBuilder)
)

type alertRuleSearchBuilder struct{}

func (alertRuleSearchBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	rule := &rulesv0alpha1.AlertRule{}
	doc, err := NewIndexableDocumentFromValue(key, rv, value, rule, rulesv0alpha1.AlertRuleKind())
	if err != nil {
		return nil, err
	}
	doc.Fields[ruleSearchType] = "alertrule"
	var uids []string
	for _, e := range rule.Spec.Expressions {
		if e.DatasourceUID != nil {
			uids = appendSourceUID(uids, string(*e.DatasourceUID))
		}
	}
	if len(uids) > 0 {
		doc.Fields[ruleSearchDatasourceUIDs] = uids
	}
	if rule.Spec.Paused != nil {
		doc.Fields[ruleSearchPaused] = *rule.Spec.Paused
	}
	if rule.Spec.PanelRef != nil {
		doc.Fields[ruleSearchDashboardUID] = rule.Spec.PanelRef.DashboardUID
		doc.Fields[ruleSearchPanelID] = rule.Spec.PanelRef.PanelID
	}
	if terms := labelTerms(rule.Spec.Labels); len(terms) > 0 {
		doc.Fields[ruleSearchLabels] = terms
	}
	return doc, nil
}

type recordingRuleSearchBuilder struct{}

func (recordingRuleSearchBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	rule := &rulesv0alpha1.RecordingRule{}
	doc, err := NewIndexableDocumentFromValue(key, rv, value, rule, rulesv0alpha1.RecordingRuleKind())
	if err != nil {
		return nil, err
	}
	doc.Fields[ruleSearchType] = "recordingrule"
	var uids []string
	for _, e := range rule.Spec.Expressions {
		if e.DatasourceUID != nil {
			uids = appendSourceUID(uids, string(*e.DatasourceUID))
		}
	}
	if len(uids) > 0 {
		doc.Fields[ruleSearchDatasourceUIDs] = uids
	}
	if rule.Spec.Paused != nil {
		doc.Fields[ruleSearchPaused] = *rule.Spec.Paused
	}
	if rule.Spec.Metric != "" {
		doc.Fields[ruleSearchMetric] = string(rule.Spec.Metric)
	}
	if rule.Spec.TargetDatasourceUID != "" {
		doc.Fields[ruleSearchTargetDatasourceUID] = string(rule.Spec.TargetDatasourceUID)
	}
	if terms := labelTerms(rule.Spec.Labels); len(terms) > 0 {
		doc.Fields[ruleSearchLabels] = terms
	}
	return doc, nil
}

func appendSourceUID(uids []string, uid string) []string {
	if uid == "" {
		return uids
	}
	if _, server := serverSideDatasourceUIDs[uid]; server {
		return uids
	}
	for _, existing := range uids {
		if existing == uid {
			return uids
		}
	}
	return append(uids, uid)
}

// labelTerms flattens the rule's spec labels into searchable terms: a bare
// "key" term (for existence matchers) and a "key=value" term (for equality).
func labelTerms[T ~string](labels map[string]T) []string {
	if len(labels) == 0 {
		return nil
	}
	out := make([]string, 0, len(labels)*2)
	for k, v := range labels {
		out = append(out, k, k+"="+string(v))
	}
	return out
}
