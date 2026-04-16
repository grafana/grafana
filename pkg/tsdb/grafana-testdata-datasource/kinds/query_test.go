package kinds

import (
	"path/filepath"
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"

	sdkapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
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
				reflect.TypeFor[NodesQueryType](),
				reflect.TypeFor[StreamingQueryType](),
				reflect.TypeFor[ErrorType](),
				reflect.TypeFor[ErrorSource](),
				reflect.TypeFor[TestDataQueryType](),
			},
		})
	require.NoError(t, err)
	err = builder.AddQueries([]schemabuilder.QueryTypeInfo{{
		Name:   "default",
		GoType: reflect.TypeFor[*TestDataQuery](),
	}})
	require.NoError(t, err)

	err = builder.AddExamples([]sdkapi.QueryExample{{
		Name: "simple random walk",
		SaveModel: sdkapi.AsUnstructured(
			TestDataQuery{
				ScenarioId: TestDataQueryTypeRandomWalk,
			},
		),
	}, {
		Name: "pulse wave example",
		SaveModel: sdkapi.AsUnstructured(
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
		SaveModel: sdkapi.AsUnstructured(
			TestDataQuery{
				ScenarioId:  TestDataQueryTypeRandomWalk,
				SeriesCount: 10,
				Spread:      0.2,
			},
		),
	}})

	builder.UpdateQueryTypes(t, "v0alpha1", filepath.Join(pluginDirectory, "schema"))
}
