package search

import (
	"maps"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func selectorForBackend(gr schema.GroupResource, backend Backend) *dualwrite.Selector[Backend] {
	return dualwrite.NewSelector(dualwrite.ProvideServiceForTests(&setting.Cfg{}), gr, backend, backend)
}

func newUnifiedHandler(alerts, recordings resourcepb.ResourceIndexClient) *Handler {
	return NewHandler(selectorForBackend(alertrule.ResourceInfo.GroupResource(), NewUnifiedClient(alerts)),
		selectorForBackend(recordingrule.ResourceInfo.GroupResource(), NewUnifiedClient(recordings)))
}

func ruleRows(t *testing.T, rule *ngmodels.AlertRule) *resourcepb.ResourceSearchResponse {
	t.Helper()
	return ruleResponse(t, ruleKey("default", rule), ruleColumnValues(rule))
}

func ruleResponse(t *testing.T, key *resourcepb.ResourceKey, values map[string]any) *resourcepb.ResourceSearchResponse {
	t.Helper()
	// Unset optional strings in legacy rule models should be absent in fixtures.
	values = maps.Clone(values)
	maps.DeleteFunc(values, func(_ string, value any) bool {
		text, ok := value.(string)
		return ok && text == ""
	})
	row := &resourcepb.ResourceSearchRow{Key: key}
	response := &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Rows:         []*resourcepb.ResourceSearchRow{row},
		TotalHits:    1, TotalHitsExact: true,
	}
	for _, name := range resultColumns {
		value, ok := values[name]
		if !ok {
			continue
		}
		field := &resourcepb.ResourceSearchField{Name: name}
		encoded := &resourcepb.ResourceSearchValue{FieldIndex: uint32(len(response.Fields))}
		switch value := value.(type) {
		case string:
			field.Type = resourcepb.ResourceSearchField_STRING
			encoded.StringValues = []string{value}
		case []string:
			field.Type, field.IsArray = resourcepb.ResourceSearchField_STRING, true
			encoded.StringValues = value
		case bool:
			field.Type = resourcepb.ResourceSearchField_BOOLEAN
			encoded.BooleanValues = []bool{value}
		case int64:
			field.Type = resourcepb.ResourceSearchField_INT64
			encoded.Int64Values = []int64{value}
		case float64:
			field.Type = resourcepb.ResourceSearchField_DOUBLE
			encoded.DoubleValues = []float64{value}
		default:
			t.Fatalf("unsupported fixture value %T for %s", value, name)
		}
		response.Fields = append(response.Fields, field)
		row.Values = append(row.Values, encoded)
	}
	require.Len(t, row.Values, len(values))
	return response
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
