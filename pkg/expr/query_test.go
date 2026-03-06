package expr

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/schemabuilder"

	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/expr/mathexp"
)

func TestQueryTypeDefinitions(t *testing.T) {
	builder, err := schemabuilder.NewSchemaBuilder(
		schemabuilder.BuilderOptions{
			PluginID: []string{DatasourceType},
			ScanCode: []schemabuilder.CodePaths{{
				BasePackage: "github.com/grafana/grafana/pkg/expr",
				CodePath:    "./",
			}},
			Enums: []reflect.Type{
				reflect.TypeOf(mathexp.ReducerSum),   // pick an example value (not the root)
				reflect.TypeOf(mathexp.UpsamplerPad), // pick an example value (not the root)
				reflect.TypeOf(ReduceModeDrop),       // pick an example value (not the root)
				reflect.TypeOf(ThresholdIsAbove),
				reflect.TypeOf(classic.ConditionOperatorAnd),
			},
		})
	require.NoError(t, err)
	err = builder.AddQueries(
		schemabuilder.QueryTypeInfo{
			Discriminators: data.NewDiscriminators("type", QueryTypeMath),
			GoType:         reflect.TypeOf(&MathQuery{}),
			Examples: []data.QueryExample{
				{
					Name: "constant addition",
					SaveModel: data.AsUnstructured(MathQuery{
						Expression: "$A + 10",
					}),
				},
				{
					Name: "math with two queries",
					SaveModel: data.AsUnstructured(MathQuery{
						Expression: "$A - $B",
					}),
				},
			},
		},
		schemabuilder.QueryTypeInfo{
			Discriminators: data.NewDiscriminators("type", QueryTypeReduce),
			GoType:         reflect.TypeOf(&ReduceQuery{}),
			Examples: []data.QueryExample{
				{
					Name: "get max value",
					SaveModel: data.AsUnstructured(ReduceQuery{
						Expression: "$A",
						Reducer:    mathexp.ReducerMax,
						Settings: &ReduceSettings{
							Mode: ReduceModeDrop,
						},
					}),
				},
			},
		},
		schemabuilder.QueryTypeInfo{
			Discriminators: data.NewDiscriminators("type", QueryTypeResample),
			GoType:         reflect.TypeOf(&ResampleQuery{}),
			Examples: []data.QueryExample{
				{
					Name: "resample at a every day",
					SaveModel: data.AsUnstructured(ResampleQuery{
						Expression:  "$A",
						Window:      "1d",
						Downsampler: mathexp.ReducerLast,
						Upsampler:   mathexp.UpsamplerPad,
					}),
				},
			},
		},
		schemabuilder.QueryTypeInfo{
			Discriminators: data.NewDiscriminators("type", QueryTypeSQL),
			GoType:         reflect.TypeOf(&SQLExpression{}),
			Examples: []data.QueryExample{
				{
					Name: "Select the first row from A",
					SaveModel: data.AsUnstructured(SQLExpression{
						Expression: "SELECT * FROM A limit 1",
					}),
				},
			},
		},
		schemabuilder.QueryTypeInfo{
			Discriminators: data.NewDiscriminators("type", QueryTypeClassic),
			GoType:         reflect.TypeOf(&ClassicQuery{}),
			Examples: []data.QueryExample{
				{
					Name: "Where query A > 5",
					SaveModel: data.AsUnstructured(ClassicQuery{
						Conditions: []classic.ConditionJSON{
							{
								Query: classic.ConditionQueryJSON{
									Params: []string{"A"},
								},
								Reducer: classic.ConditionReducerJSON{
									Type: "max",
								},
								Operator: classic.ConditionOperatorJSON{
									Type: "and",
								},
								Evaluator: classic.ConditionEvalJSON{
									Type:   "gt",
									Params: []float64{5},
								},
							},
						},
					}),
				},
			},
		},
		schemabuilder.QueryTypeInfo{
			Discriminators: data.NewDiscriminators("type", QueryTypeThreshold),
			GoType:         reflect.TypeOf(&ThresholdQuery{}),
			Examples: []data.QueryExample{
				{
					Name: "Where query A > 5",
					SaveModel: data.AsUnstructured(ThresholdQuery{
						Expression: "A",
						Conditions: []ThresholdConditionJSON{{
							Evaluator: ConditionEvalJSON{
								Type:   ThresholdIsAbove,
								Params: []float64{5},
							},
						}},
					}),
				},
				{
					Name: "With loaded+unloaded evaluators",
					SaveModel: toUnstructured(`{
						"expression": "B",
						"conditions": [
						  {
							"evaluator": {
							  "params": [
								100
							  ],
							  "type": "gt"
							},
							"unloadEvaluator": {
							  "params": [
								31
							  ],
							  "type": "lt"
							},
							"loadedDimensions": {"schema":{"name":"test","meta":{"type":"fingerprints","typeVersion":[1,0]},"fields":[{"name":"fingerprints","type":"number","typeInfo":{"frame":"uint64"}}]},"data":{"values":[[18446744073709551615,2,3,4,5]]}}
						  }
						]
					  }`),
				},
			},
		},
	)

	require.NoError(t, err)
	_ = builder.UpdateQueryDefinition(t, "./")
}

func toUnstructured(ex string) data.Unstructured {
	v := data.Unstructured{}
	_ = json.Unmarshal([]byte(ex), &v.Object)
	return v
}
