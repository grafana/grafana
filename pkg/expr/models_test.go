package expr

import (
	"reflect"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/schema"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/expr/mathexp"
)

func TestQueryTypeDefinitions(t *testing.T) {
	builder, err := schema.NewSchemaBuilder(
		schema.BuilderOptions{
			BasePackage: "github.com/grafana/grafana/pkg/registry/apis/query/expr",
			CodePath:    "./",
			// We need to identify the enum fields explicitly :(
			// *AND* have the +enum common for this to work
			Enums: []reflect.Type{
				reflect.TypeOf(mathexp.ReducerSum), // pick an example value (not the root)
				reflect.TypeOf(ReduceModeDrop),     // pick an example value (not the root)
			},
		})
	require.NoError(t, err)
	err = builder.AddQueries(
		schema.QueryTypeInfo{
			Discriminators: schema.NewDiscriminators("queryType", QueryTypeMath),
			GoType:         reflect.TypeOf(&MathQuery{}),
			Examples: []schema.QueryExample{
				{
					Name: "constant addition",
					QueryPayload: MathQuery{
						Expression: "$A + 10",
					},
				},
				{
					Name: "math with two queries",
					QueryPayload: MathQuery{
						Expression: "$A - $B",
					},
				},
			},
		},
		schema.QueryTypeInfo{
			Discriminators: schema.NewDiscriminators("queryType", QueryTypeReduce),
			GoType:         reflect.TypeOf(&ReduceQuery{}),
			Examples: []schema.QueryExample{
				{
					Name: "get max value",
					QueryPayload: ReduceQuery{
						Expression: "$A",
						Reducer:    mathexp.ReducerMax,
						Settings: &ReduceSettings{
							Mode: ReduceModeDrop,
						},
					},
				},
			},
		},
		schema.QueryTypeInfo{
			Discriminators: schema.NewDiscriminators("queryType", QueryTypeResample),
			GoType:         reflect.TypeOf(&ResampleQuery{}),
			Examples: []schema.QueryExample{
				{
					Name: "resample at a every day",
					QueryPayload: ResampleQuery{
						Expression: "$A",
						Window:     "1d",
					},
				},
			},
		},
		schema.QueryTypeInfo{
			Discriminators: schema.NewDiscriminators("queryType", QueryTypeClassic),
			GoType:         reflect.TypeOf(&ClassicQuery{}),
			Examples: []schema.QueryExample{
				{
					Name: "do classic query (TODO)",
					QueryPayload: ClassicQuery{
						// ????
						Conditions: []classic.ConditionJSON{},
					},
				},
			},
		},
		schema.QueryTypeInfo{
			Discriminators: schema.NewDiscriminators("queryType", QueryTypeThreshold),
			GoType:         reflect.TypeOf(&ThresholdQuery{}),
			Examples: []schema.QueryExample{
				{
					Name: "TODO... a threshold query",
					QueryPayload: ThresholdQuery{
						Expression: "$A",
					},
				},
			},
		},
	)

	require.NoError(t, err)
	builder.UpdateQueryDefinition(t, "models.types.json")

	// qt, err := NewExpressionQueryReader(featuremgmt.WithFeatures())
	// require.NoError(t, err)
	// s, err := schema.GetQuerySchema(qt.QueryTypeDefinitionList())
	// require.NoError(t, err)

	// out, err := json.MarshalIndent(s, "", "  ")
	// require.NoError(t, err)

	// err = os.WriteFile("schema.jsonschema", out, 0644)
	// require.NoError(t, err, "error writing file")
}
