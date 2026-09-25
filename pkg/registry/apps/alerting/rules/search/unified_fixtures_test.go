package search

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	rulesmanifest "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func selectorForBackend(gr schema.GroupResource, backend Backend) *dualwrite.Selector[Backend] {
	return dualwrite.NewSelector(dualwrite.ProvideServiceForTests(&setting.Cfg{}), gr, backend, backend)
}

func newUnifiedHandler(alerts, recordings resourcepb.ResourceIndexClient) *Handler {
	return NewHandler(selectorForBackend(alertrule.ResourceInfo.GroupResource(), NewUnifiedClient(alerts)),
		selectorForBackend(recordingrule.ResourceInfo.GroupResource(), NewUnifiedClient(recordings)))
}

func decodeTestResult(t *testing.T, resp *resourcepb.ResourceSearchResponse) *Result {
	t.Helper()
	result, err := NewUnifiedClient(&fakeIndex{resp: resp}).Search(t.Context(), &Query{})
	require.NoError(t, err)
	return result
}

// These encoders build old-server response fixtures, not legacy backend results.
var searchColumns = buildSearchColumns()
var results = buildResultTable()

func buildSearchColumns() map[string]*resourcepb.ResourceTableColumnDefinition {
	std := resource.StandardSearchFields()
	out := map[string]*resourcepb.ResourceTableColumnDefinition{fieldTitle: std.Field(fieldTitle), fieldFolder: std.Field(fieldFolder)}
	provider := resource.NewManifestBackedProvider(rulesmanifest.LocalManifest().ManifestData)
	for _, gr := range []schema.GroupResource{alertrule.ResourceInfo.GroupResource(), recordingrule.ResourceInfo.GroupResource()} {
		for _, col := range resource.SearchFieldDefinitionsToTableColumns(provider.Fields(schema.GroupVersionResource{Group: gr.Group, Resource: gr.Resource})) {
			if _, ok := out[col.Name]; !ok {
				out[col.Name] = col
			}
		}
	}
	return out
}

type resultTable struct {
	defs     []*resourcepb.ResourceTableColumnDefinition
	index    map[string]int
	encoders []resource.ResourceColumnEncoder
	skipped  []string
	err      error
}

func buildResultTable() resultTable {
	t := resultTable{index: map[string]int{}}
	for _, name := range resultColumns {
		col := searchColumns[name]
		if col == nil || col.Type == resourcepb.ResourceTableColumnDefinition_UNKNOWN_TYPE {
			t.skipped = append(t.skipped, name)
			continue
		}
		t.index[name] = len(t.defs)
		t.defs = append(t.defs, col)
	}
	builder, err := resource.NewTableBuilder(t.defs)
	if err != nil {
		t.err = err
		return t
	}
	t.encoders = builder.Encoders()
	return t
}

func resultColumnDefinitions() []*resourcepb.ResourceTableColumnDefinition { return results.defs }

func ruleCells(values map[string]any) ([][]byte, error) {
	if results.err != nil {
		return nil, results.err
	}
	cells := make([][]byte, len(results.defs))
	for name, v := range values {
		i, ok := results.index[name]
		if !ok {
			continue
		}
		cell, err := results.encoders[i](v)
		if err != nil {
			return nil, fmt.Errorf("encoding column %q: %w", name, err)
		}
		cells[i] = cell
	}
	return cells, nil
}

func ruleKey(namespace string, rule *ngmodels.AlertRule) *resourcepb.ResourceKey {
	gr := alertrule.ResourceInfo.GroupResource()
	if rule.Type() == ngmodels.RuleTypeRecording {
		gr = recordingrule.ResourceInfo.GroupResource()
	}
	key := resourceKey(namespace, gr)
	key.Name = rule.UID
	return key
}
