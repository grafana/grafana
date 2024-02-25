package expr

import (
	"reflect"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/spec"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/expr/mathexp"
)

func TestQueryTypeDefinitions(t *testing.T) {
	builder, err := spec.NewSchemaBuilder(
		spec.BuilderOptions{
			BasePackage: "github.com/grafana/grafana/pkg/expr",
			CodePath:    "./",
			// We need to identify the enum fields explicitly :(
			// *AND* have the +enum common for this to work
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
		spec.QueryTypeInfo{
			Discriminators: spec.NewDiscriminators("queryType", QueryTypeMath),
			GoType:         reflect.TypeOf(&MathQuery{}),
			Examples: []spec.QueryExample{
				{
					Name: "constant addition",
					SaveModel: MathQuery{
						Expression: "$A + 10",
					},
				},
				{
					Name: "math with two queries",
					SaveModel: MathQuery{
						Expression: "$A - $B",
					},
				},
			},
		},
		spec.QueryTypeInfo{
			Discriminators: spec.NewDiscriminators("queryType", QueryTypeReduce),
			GoType:         reflect.TypeOf(&ReduceQuery{}),
			Examples: []spec.QueryExample{
				{
					Name: "get max value",
					SaveModel: ReduceQuery{
						Expression: "$A",
						Reducer:    mathexp.ReducerMax,
						Settings: &ReduceSettings{
							Mode: ReduceModeDrop,
						},
					},
				},
			},
		},
		spec.QueryTypeInfo{
			Discriminators: spec.NewDiscriminators("queryType", QueryTypeResample),
			GoType:         reflect.TypeOf(&ResampleQuery{}),
			Examples: []spec.QueryExample{
				{
					Name: "resample at a every day",
					SaveModel: ResampleQuery{
						Expression:  "$A",
						Window:      "1d",
						Downsampler: mathexp.ReducerLast,
						Upsampler:   mathexp.UpsamplerPad,
					},
				},
			},
		},
		spec.QueryTypeInfo{
			Discriminators: spec.NewDiscriminators("queryType", QueryTypeClassic),
			GoType:         reflect.TypeOf(&ClassicQuery{}),
			Examples: []spec.QueryExample{
				{
					Name: "do classic query (TODO)",
					SaveModel: ClassicQuery{
						// ????
						Conditions: []classic.ConditionJSON{},
					},
				},
			},
		},
		spec.QueryTypeInfo{
			Discriminators: spec.NewDiscriminators("queryType", QueryTypeThreshold),
			GoType:         reflect.TypeOf(&ThresholdQuery{}),
			Examples: []spec.QueryExample{
				{
					Name: "TODO... a threshold query",
					SaveModel: ThresholdQuery{
						Expression: "$A",
					},
				},
			},
		},
	)

	require.NoError(t, err)
	_ = builder.UpdateQueryDefinition(t, "./")
}
