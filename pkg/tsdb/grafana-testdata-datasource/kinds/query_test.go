package kinds

import (
	"reflect"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource/schemabuilder"
	"github.com/stretchr/testify/require"
)

func TestQueryTypeDefinitions(t *testing.T) {
	builder, err := schemabuilder.NewSchemaBuilder(
		schemabuilder.BuilderOptions{
			PluginID: []string{"grafana-testdata-datasource", "testdata"},
			ScanCode: []schemabuilder.CodePaths{{
				BasePackage: "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource/kinds",
				CodePath:    "./",
			}},
			Enums: []reflect.Type{
				reflect.TypeOf(NodesQueryTypeRandom),         // pick an example value (not the root)
				reflect.TypeOf(StreamingQueryTypeFetch),      // pick an example value (not the root)
				reflect.TypeOf(ErrorTypeServerPanic),         // pick an example value (not the root)
				reflect.TypeOf(TestDataQueryTypeAnnotations), // pick an example value (not the root)
			},
		})
	require.NoError(t, err)
	err = builder.AddQueries(
		schemabuilder.QueryTypeInfo{
			Name:   "default",
			GoType: reflect.TypeOf(&TestDataDataQuery{}),
			Examples: []resource.QueryExample{
				{
					Name: "example timeseries",
					SaveModel: TestDataDataQuery{
						ScenarioId: TestDataQueryTypeManualEntry,
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
