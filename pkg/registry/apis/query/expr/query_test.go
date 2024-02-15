package expr

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/query"
	extschema "github.com/grafana/grafana-plugin-sdk-go/experimental/query/schema"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/registry/apis/query/schema"
)

func TestQueryTypeDefinitions(t *testing.T) {
	builder, err := extschema.NewBuilder(
		extschema.BuilderOptions{
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
		extschema.QueryTypeInfo{
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
		extschema.QueryTypeInfo{
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
		extschema.QueryTypeInfo{
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
		extschema.QueryTypeInfo{
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
		extschema.QueryTypeInfo{
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
	builder.UpdateSchemaDefinition(t, "query.json")

	qt, err := NewQueryHandler()
	require.NoError(t, err)
	s, err := schema.GetQuerySchema(qt.QueryTypeDefinitionList())
	require.NoError(t, err)

	out, err := json.MarshalIndent(s, "", "  ")
	require.NoError(t, err)

	err = os.WriteFile("query.jsonschema", out, 0644)
	require.NoError(t, err, "error writing file")
}
