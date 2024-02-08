package expressions

import (
	"encoding/json"

	openapi "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/query/v0alpha1/definition"
)

const QueryTypeMath = "math"
const QueryTypeReduce = "reduce"
const QueryTypeResample = "resample"
const QueryTypeClassic = "classic"
const QueryTypeThreshold = "threshold"

func GetQueryTypeDefinitions() map[string]definition.QueryTypeSpec {
	ref := func(path string) spec.Ref {
		return spec.Ref{}
	}
	return map[string]definition.QueryTypeSpec{
		QueryTypeMath: {
			Description: "execute math commands",
			Versions: []definition.QueryTypeVersion{
				{
					Schema: getPropsJSONSchema("github.com/grafana/grafana/pkg/apis/query/v0alpha1/expressions.MathQueryTypeProperties", ref),
					// Examples: []definition.ExampleInfo{
					// 	{
					// 		Name:        "simple example",
					// 		Description: "adding two series",
					// 		Query: query.GenericDataQuery{
					// 			QueryType: "TODO.... use the map to set something reasonable",
					// 		},
					// 	},
					// },
					Changelog: []string{
						"initial version",
					},
				},
			},
		},
		QueryTypeReduce: {
			Description: "reduce function",
			Versions: []definition.QueryTypeVersion{
				{
					Schema: getPropsJSONSchema("github.com/grafana/grafana/pkg/apis/query/v0alpha1/expressions.ReduceQueryTypeProperties", ref),
					// Examples: []definition.ExampleInfo{
					// 	{
					// 		Name:        "simple example",
					// 		Description: "adding two series",
					// 		Query: query.GenericDataQuery{
					// 			QueryType: "TODO.... use the map to set something reasonable",
					// 		},
					// 	},
					// },
					Changelog: []string{
						"initial version",
					},
				},
			},
		},
		QueryTypeResample: {
			Description: "resample function",
			Versions: []definition.QueryTypeVersion{
				{
					Schema: getPropsJSONSchema("github.com/grafana/grafana/pkg/apis/query/v0alpha1/expressions.ResampleQueryTypeProperties", ref),
					// Examples: []definition.ExampleInfo{
					// 	{
					// 		Name:        "simple example",
					// 		Description: "adding two series",
					// 		Query: query.GenericDataQuery{
					// 			QueryType: "TODO.... use the map to set something reasonable",
					// 		},
					// 	},
					// },
					Changelog: []string{
						"initial version",
					},
				},
			},
		},
		QueryTypeThreshold: {
			Description: "threshold function",
			Versions: []definition.QueryTypeVersion{
				{
					Schema: getPropsJSONSchema("github.com/grafana/grafana/pkg/apis/query/v0alpha1/expressions.ThresholdQueryTypeProperties", ref),
					// Examples: []definition.ExampleInfo{
					// 	{
					// 		Name:        "simple example",
					// 		Description: "adding two series",
					// 		Query: query.GenericDataQuery{
					// 			QueryType: "TODO.... use the map to set something reasonable",
					// 		},
					// 	},
					// },
					Changelog: []string{
						"initial version",
					},
				},
			},
		},
		QueryTypeClassic: {
			Description: "classic function",
			Versions: []definition.QueryTypeVersion{
				{
					Schema: getPropsJSONSchema("github.com/grafana/grafana/pkg/apis/query/v0alpha1/expressions.ClassicQueryTypeProperties", ref),
					// Examples: []query.ExampleInfo{
					// 	{
					// 		Name:        "simple example",
					// 		Description: "adding two series",
					// 		Query: query.GenericDataQuery{
					// 			QueryType: "TODO.... use the map to set something reasonable",
					// 		},
					// 	},
					// },
					Changelog: []string{
						"initial version",
					},
				},
			},
		},
	}
}

// We still need a k8s friendly way to encode JSONSchema... maybe:
// https://github.com/kubernetes/apiextensions-apiserver/blob/v0.29.1/pkg/apis/apiextensions/types_jsonschema.go#L40
// but maybe a generic object is not bad -- since anything using it will need to parse as JSONSchema anyway
func getPropsJSONSchema(key string, ref openapi.ReferenceCallback) (schema common.Unstructured) {
	def, ok := query.GetOpenAPIDefinitions(ref)[key]
	if !ok {
		return
	}
	out, err := json.Marshal(def.Schema)
	if err != nil {
		return
	}
	_ = json.Unmarshal(out, &schema.Object)
	return
}
