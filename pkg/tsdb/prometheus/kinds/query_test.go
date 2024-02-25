package kinds

import (
	"reflect"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/spec"
	"github.com/stretchr/testify/require"
)

func TestQueryTypeDefinitions(t *testing.T) {
	builder, err := spec.NewSchemaBuilder(
		spec.BuilderOptions{
			BasePackage: "github.com/grafana/grafana/pkg/tsdb/prometheus/kinds",
			CodePath:    "./",
			// We need to identify the enum fields explicitly :(
			// *AND* have the +enum common for this to work
			Enums: []reflect.Type{
				reflect.TypeOf(PromQueryFormatTimeSeries), // pick an example value (not the root)
				reflect.TypeOf(QueryEditorModeCode),       // pick an example value (not the root)
			},
		})
	require.NoError(t, err)
	err = builder.AddQueries(
		spec.QueryTypeInfo{
			Name:   "default",
			GoType: reflect.TypeOf(&PrometheusDataQuery{}),
			Examples: []spec.QueryExample{
				{
					Name: "example timeseries",
					SaveModel: PrometheusDataQuery{
						Format: PromQueryFormatTimeSeries,
						Expr:   "???",
					},
				},
				{
					Name: "example table",
					SaveModel: PrometheusDataQuery{
						Format: PromQueryFormatTable,
						Expr:   "???",
					},
				},
			},
		},
	)

	require.NoError(t, err)
	builder.UpdateQueryDefinition(t, "./")

	// qt, err := NewQueryHandler()
	// require.NoError(t, err)
	// s, err := schemaex.GetQuerySchema(qt.QueryTypeDefinitionList())
	// require.NoError(t, err)

	// out, err := json.MarshalIndent(s, "", "  ")
	// require.NoError(t, err)

	// err = os.WriteFile("dataquery.spec.json", out, 0644)
	// require.NoError(t, err, "error writing file")
}
