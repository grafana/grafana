package expr

import (
	"reflect"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/query"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/query/schema"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/classic"
)

func TestQueryTypeDefinitions(t *testing.T) {
	builder, err := schema.NewBuilder(
		schema.BuilderOptions{
			BasePackage:        "github.com/grafana/grafana/pkg/registry/apis/query/expr",
			CodePath:           "./",
			DiscriminatorField: "queryType",
			// We need to identify the enum fields explicitly :(
			// *AND* have the +enum common for this to work
			Enums: []reflect.Type{
				reflect.TypeOf(ReducerSum),     // pick an example value (not the root)
				reflect.TypeOf(ReduceModeDrop), // pick an example value (not the root)
			},
		},
		schema.QueryTypeInfo{
			Discriminator: string(QueryTypeMath),
			GoType:        reflect.TypeOf(&MathQuery{}),
			Examples: []query.QueryExample{
				{
					Name: "constant addition",
					Query: MathQuery{
						Expression: "$A + 10",
					},
				},
				{
					Name: "math with two queries",
					Query: MathQuery{
						Expression: "$A - $B",
					},
				},
			},
		},
		schema.QueryTypeInfo{
			Discriminator: string(QueryTypeReduce),
			GoType:        reflect.TypeOf(&ReduceQuery{}),
			Examples: []query.QueryExample{
				{
					Name: "get max value",
					Query: ReduceQuery{
						Expression: "$A",
						Reducer:    ReducerMax,
						Settings: &ReduceSettings{
							Mode: ReduceModeDrop,
						},
					},
				},
			},
		},
		schema.QueryTypeInfo{
			Discriminator: string(QueryTypeResample),
			GoType:        reflect.TypeOf(&ResampleQuery{}),
			Examples: []query.QueryExample{
				{
					Name: "resample at a every day",
					Query: ResampleQuery{
						Expression: "$A",
						Window:     "1d",
					},
				},
			},
		},
		schema.QueryTypeInfo{
			Discriminator: string(QueryTypeClassic),
			GoType:        reflect.TypeOf(&ClassicQuery{}),
			Examples: []query.QueryExample{
				{
					Name: "do classic query (TODO)",
					Query: ClassicQuery{
						// ????
						Conditions: []classic.ConditionJSON{},
					},
				},
			},
		},
		schema.QueryTypeInfo{
			Discriminator: string(QueryTypeThreshold),
			GoType:        reflect.TypeOf(&ThresholdQuery{}),
			Examples: []query.QueryExample{
				{
					Name: "TODO... a threshold query",
					Query: ThresholdQuery{
						Expression: "$A",
					},
				},
			},
		},
	)

	require.NoError(t, err)
	builder.UpdateSchemaDefinition(t, "models.json")

	// qt, err := NewExpressionQueryReader(featuremgmt.WithFeatures())
	// require.NoError(t, err)
	// s, err := schema.GetQuerySchema(qt.QueryTypeDefinitionList())
	// require.NoError(t, err)

	// out, err := json.MarshalIndent(s, "", "  ")
	// require.NoError(t, err)

	// err = os.WriteFile("query.jsonschema", out, 0644)
	// require.NoError(t, err, "error writing file")
}
