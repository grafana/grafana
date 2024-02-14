package dataquery2

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/query"
	extschema "github.com/grafana/grafana-plugin-sdk-go/experimental/query/schema"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apis/query/schema"
)

func TestQueryTypeDefinitions(t *testing.T) {
	builder, err := extschema.NewBuilder(t,
		extschema.BuilderOptions{
			BasePackage: "github.com/grafana/grafana/pkg/tsdb/prometheus/kinds/dataquery2",
			CodePath:    "./",
			// We need to identify the enum fields explicitly :(
			// *AND* have the +enum common for this to work
			Enums: []reflect.Type{
				reflect.TypeOf(PromQueryFormatTimeSeries), // pick an example value (not the root)
				reflect.TypeOf(QueryEditorModeCode),       // pick an example value (not the root)
			},
		},
		extschema.QueryTypeInfo{
			GoType: reflect.TypeOf(&PrometheusDataQuery{}),
			Examples: []query.QueryExample{
				{
					Name: "example timeseries",
					Query: PrometheusDataQuery{
						Format: PromQueryFormatTimeSeries,
						Expr:   "???",
					},
				},
				{
					Name: "example table",
					Query: PrometheusDataQuery{
						Format: PromQueryFormatTable,
						Expr:   "???",
					},
				},
			},
		},
	)

	require.NoError(t, err)
	_ = builder.Write("types.json")

	qt, err := NewQueryHandler()
	require.NoError(t, err)
	s, err := schema.GetQuerySchema(qt.QueryTypeDefinitionList())
	require.NoError(t, err)

	out, err := json.MarshalIndent(s, "", "  ")
	require.NoError(t, err)

	err = os.WriteFile("types.jsonschema", out, 0644)
	require.NoError(t, err, "error writing file")
}
