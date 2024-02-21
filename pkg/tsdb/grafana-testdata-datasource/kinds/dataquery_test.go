package kinds

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/schema"
	"github.com/stretchr/testify/require"
)

func TestQueryTypeDefinitions(t *testing.T) {
	builder, err := schema.NewSchemaBuilder(
		schema.BuilderOptions{
			BasePackage: "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource/kinds",
			CodePath:    "./",
			// We need to identify the enum fields explicitly :(
			// *AND* have the +enum common for this to work
			Enums: []reflect.Type{
				reflect.TypeOf(NodesQueryTypeRandom),         // pick an example value (not the root)
				reflect.TypeOf(StreamingQueryTypeFetch),      // pick an example value (not the root)
				reflect.TypeOf(ErrorTypeServerPanic),         // pick an example value (not the root)
				reflect.TypeOf(TestDataQueryTypeAnnotations), // pick an example value (not the root)
			},
		})
	require.NoError(t, err)
	err = builder.AddQueries(
		schema.QueryTypeInfo{
			Name:   "default",
			GoType: reflect.TypeOf(&TestDataDataQuery{}),
			Examples: []schema.QueryExample{
				{
					Name: "example timeseries",
					QueryPayload: TestDataDataQuery{
						ScenarioId: TestDataQueryTypeManualEntry,
					},
				},
			},
		},
	)

	require.NoError(t, err)
	builder.UpdateQueryDefinition(t, "dataquery.types.json")

	qt, err := NewQueryHandler()
	require.NoError(t, err)
	s, err := schema.GetQuerySchema(qt.QueryTypeDefinitionList())
	require.NoError(t, err)

	out, err := json.MarshalIndent(s, "", "  ")
	require.NoError(t, err)

	err = os.WriteFile("dataquery.schema.json", out, 0644)
	require.NoError(t, err, "error writing file")
}
