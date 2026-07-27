package builders

import (
	"context"
	"encoding/json"
	"sort"

	rulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Rule search field/column names. These must match the keys the alerting rule
// search handler uses when building ResourceSearchRequests so the legacy and
// unified backends are interchangeable, and the "name" values declared for the
// rule kinds' searchFields in apps/alerting/rules/kinds/{alertRule,recordingRule}.cue.
const (
	ruleSearchType           = "type"
	ruleSearchLabels         = "labels"
	ruleSearchAnnotations    = "annotations"
	ruleSearchDatasourceUIDs = "datasourceUIDs"
)

func GetAlertRuleSearchBuilder(registry *resource.SearchFieldsRegistry) (resource.DocumentBuilderInfo, error) {
	gr := rulesv0alpha1.AlertRuleKind().GroupVersionResource().GroupResource()
	return resource.DocumentBuilderInfo{
		GroupResource: gr,
		Builder:       &alertRuleSearchBuilder{declared: resource.StandardDocumentBuilder(registry)},
	}, nil
}

func GetRecordingRuleSearchBuilder(registry *resource.SearchFieldsRegistry) (resource.DocumentBuilderInfo, error) {
	gr := rulesv0alpha1.RecordingRuleKind().GroupVersionResource().GroupResource()
	return resource.DocumentBuilderInfo{
		GroupResource: gr,
		Builder:       &recordingRuleSearchBuilder{declared: resource.StandardDocumentBuilder(registry)},
	}, nil
}

var (
	_ resource.DocumentBuilder = new(alertRuleSearchBuilder)
	_ resource.DocumentBuilder = new(recordingRuleSearchBuilder)
)

// alertRuleSearchBuilder builds an AlertRule search document. It delegates the
// path-declared fields (declared in the CUE manifest) to the standard document
// builder, then decodes the typed spec to compute the fields that cannot be
// expressed as a JSON path: type is a constant, labels and annotations are maps
// (the path extractor has no map support), and datasourceUIDs must exclude
// server-side expression datasources and deduplicate across the expression map.
type alertRuleSearchBuilder struct {
	declared resource.DocumentBuilder
}

func (b *alertRuleSearchBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	doc, err := b.declared.BuildDocument(ctx, key, rv, value)
	if err != nil {
		return nil, err
	}
	if doc.Fields == nil {
		doc.Fields = make(map[string]any)
	}

	// The delegate already unmarshalled value into an unstructured object to
	// extract the path-declared fields, but it does not expose it. We re-parse
	// into the typed spec here to compute the map-shaped and derived fields
	// (labels, annotations, datasourceUIDs) that cannot be expressed as a JSON
	// path. The extra parse is the cost of keeping every path field declarative
	// (in the manifest) instead of hand-populating it here.
	rule := &rulesv0alpha1.AlertRule{}
	if err := json.Unmarshal(value, rule); err != nil {
		return nil, err
	}

	doc.Fields[ruleSearchType] = "alertrule"

	if uids := alertRuleDatasourceUIDs(rule.Spec.Expressions); len(uids) > 0 {
		doc.Fields[ruleSearchDatasourceUIDs] = uids
	}
	if a := annotationsJSON(rule.Spec.Annotations); a != "" {
		doc.Fields[ruleSearchAnnotations] = a
	}
	if terms := labelTerms(rule.Spec.Labels); len(terms) > 0 {
		doc.Fields[ruleSearchLabels] = terms
	}
	return doc, nil
}

// recordingRuleSearchBuilder builds a RecordingRule search document. See
// alertRuleSearchBuilder for the delegate-then-compute pattern.
type recordingRuleSearchBuilder struct {
	declared resource.DocumentBuilder
}

func (b *recordingRuleSearchBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	doc, err := b.declared.BuildDocument(ctx, key, rv, value)
	if err != nil {
		return nil, err
	}
	if doc.Fields == nil {
		doc.Fields = make(map[string]any)
	}

	// Re-parse into the typed spec to compute the map-shaped and derived fields;
	// see alertRuleSearchBuilder.BuildDocument for why this second parse exists.
	rule := &rulesv0alpha1.RecordingRule{}
	if err := json.Unmarshal(value, rule); err != nil {
		return nil, err
	}

	doc.Fields[ruleSearchType] = "recordingrule"

	if uids := recordingRuleDatasourceUIDs(rule.Spec.Expressions); len(uids) > 0 {
		doc.Fields[ruleSearchDatasourceUIDs] = uids
	}
	if terms := labelTerms(rule.Spec.Labels); len(terms) > 0 {
		doc.Fields[ruleSearchLabels] = terms
	}
	return doc, nil
}

// alertRuleDatasourceUIDs collects the distinct user-facing query datasource
// UIDs referenced by an alert rule's expressions. The expression map has
// non-deterministic iteration order, so the result is sorted to keep indexed
// documents stable across rebuilds.
func alertRuleDatasourceUIDs(expressions map[string]rulesv0alpha1.AlertRuleExpression) []string {
	var uids []string
	for _, e := range expressions {
		if e.DatasourceUID != nil {
			uids = appendSourceUID(uids, string(*e.DatasourceUID))
		}
	}
	sort.Strings(uids)
	return uids
}

// recordingRuleDatasourceUIDs is the recording-rule counterpart of
// alertRuleDatasourceUIDs.
func recordingRuleDatasourceUIDs(expressions map[string]rulesv0alpha1.RecordingRuleExpression) []string {
	var uids []string
	for _, e := range expressions {
		if e.DatasourceUID != nil {
			uids = appendSourceUID(uids, string(*e.DatasourceUID))
		}
	}
	sort.Strings(uids)
	return uids
}

// appendSourceUID adds uid to uids unless it is empty, a synthetic server-side
// expression datasource, or already present. expr.NodeTypeFromDatasourceUID is
// the single source of truth for what counts as a real (user-facing) query
// datasource: only TypeDatasourceNode is one; the __expr__/-100 command nodes
// and the __ml__ node are excluded, and any future synthetic UID added to
// pkg/expr is excluded automatically.
func appendSourceUID(uids []string, uid string) []string {
	if uid == "" {
		return uids
	}
	if expr.NodeTypeFromDatasourceUID(uid) != expr.TypeDatasourceNode {
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

// annotationsJSON encodes rule annotations as a JSON object string for display,
// or "" when there are none.
func annotationsJSON[T ~string](annotations map[string]T) string {
	if len(annotations) == 0 {
		return ""
	}
	m := make(map[string]string, len(annotations))
	for k, v := range annotations {
		m[k] = string(v)
	}
	b, err := json.Marshal(m)
	if err != nil {
		// json.Marshal on a map[string]string cannot fail: string keys and
		// values are always encodable, there are no cycles, and no custom
		// MarshalJSON is involved. The branch is unreachable defensively;
		// returning "" degrades to "no annotations indexed" rather than
		// failing the whole document build.
		return ""
	}
	return string(b)
}
