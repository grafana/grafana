package expr

import (
	"reflect"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/query/schema"
	"github.com/stretchr/testify/require"
)

func TestQueryTypeDefinitions(t *testing.T) {
	builder, err := schema.NewBuilder(t,
		schema.BuilderOptions{
			BasePackage: "github.com/grafana/grafana/pkg/registry/apis/query/expr",
			CodePath:    "./",
		},
		schema.QueryTypeInfo{
			QueryType: string(QueryTypeMath),
			GoType:    reflect.TypeOf(&MathQuery{}),
		},
		schema.QueryTypeInfo{
			QueryType: string(QueryTypeReduce),
			GoType:    reflect.TypeOf(&ReduceQuery{}),
		},
		schema.QueryTypeInfo{
			QueryType: string(QueryTypeResample),
			GoType:    reflect.TypeOf(&ResampleQuery{}),
		})
	require.NoError(t, err)

	_ = builder.Write("types.json")
}
