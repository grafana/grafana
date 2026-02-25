package kinds

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/schemabuilder"
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
				reflect.TypeOf(ErrorSourcePlugin),            // pick an example value (not the root)
				reflect.TypeOf(TestDataQueryTypeAnnotations), // pick an example value (not the root)
			},
		})
	require.NoError(t, err)
	err = builder.AddQueries(
		schemabuilder.QueryTypeInfo{
			Name:   "default",
			GoType: reflect.TypeOf(&TestDataQuery{}),
			Examples: []data.QueryExample{
				{
					Name: "simple random walk",
					SaveModel: data.AsUnstructured(
						TestDataQuery{
							ScenarioId: TestDataQueryTypeRandomWalk,
						},
					),
				}, {
					Name: "pulse wave example",
					SaveModel: data.AsUnstructured(
						TestDataQuery{
							ScenarioId: TestDataQueryTypePredictablePulse,
							PulseWave: &PulseWaveQuery{
								TimeStep: int64(1000),
								OnCount:  10,
								OffCount: 20,
								OffValue: 1.23, // should be any (rather json any)
								OnValue:  4.56, // should be any
							},
						},
					),
				}, {
					Name: "multiple series",
					SaveModel: data.AsUnstructured(
						TestDataQuery{
							ScenarioId:  TestDataQueryTypeRandomWalk,
							SeriesCount: 10,
							Spread:      0.2,
						},
					),
				},
			},
		},
	)

	require.NoError(t, err)
	builder.UpdateQueryDefinition(t, "./")
}
