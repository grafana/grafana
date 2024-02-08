package expressions

import (
	"encoding/json"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	openapi "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

const QueryTypeMath = "math"
const QueryTypeReduce = "reduce"
const QueryTypeResample = "resample"
const QueryTypeClassic = "resample"
const QueryTypeThreshold = "threshold"

func GetQueryTypeDefinitionList() query.QueryTypeDefinitionList {
	ref := func(path string) spec.Ref {
		return spec.Ref{}
	}
	return query.QueryTypeDefinitionList{
		Items: []query.QueryTypeDefinition{
			{
				ObjectMeta: v1.ObjectMeta{
					Name: QueryTypeMath,
				},
				Spec: query.QueryTypeSpec{
					Description: "execute math commands",
					Versions: []query.QueryTypeVersion{
						{
							Schema: getPropsJSONSchema("github.com/grafana/grafana/pkg/apis/query/v0alpha1/expressions.MathQueryTypeProperties", ref),
							Examples: []query.ExampleInfo{
								{
									Name:        "simple example",
									Description: "adding two series",
									Query: query.GenericDataQuery{
										QueryType: "TODO.... use the map to set something reasonable",
									},
								},
							},
							Changelog: []string{
								"initial version",
							},
						},
					},
				},
			},
			{
				ObjectMeta: v1.ObjectMeta{
					Name: QueryTypeReduce,
				},
				Spec: query.QueryTypeSpec{
					Description: "reduce....",
					Versions: []query.QueryTypeVersion{
						{
							Schema: getPropsJSONSchema("github.com/grafana/grafana/pkg/apis/query/v0alpha1/expressions.ReduceQueryTypeProperties", ref),
							Examples: []query.ExampleInfo{
								{
									Name:        "reduce example",
									Description: "adding two series",
									Query: query.GenericDataQuery{
										QueryType: "TODO.... use the map to set something reasonable",
									},
								},
							},
							Changelog: []string{
								"initial version",
							},
						},
					},
				},
			},
			{
				ObjectMeta: v1.ObjectMeta{
					Name: QueryTypeResample,
				},
				Spec: query.QueryTypeSpec{
					Description: "resample",
					Versions: []query.QueryTypeVersion{
						{
							Schema: getPropsJSONSchema("github.com/grafana/grafana/pkg/apis/query/v0alpha1/expressions.ResampleQueryTypeProperties", ref),
							Examples: []query.ExampleInfo{
								{
									Name:        "resample example",
									Description: "adding two series",
									Query: query.GenericDataQuery{
										QueryType: "TODO.... use the map to set something reasonable",
									},
								},
							},
							Changelog: []string{
								"initial version",
							},
						},
					},
				},
			},
			{
				ObjectMeta: v1.ObjectMeta{
					Name: QueryTypeClassic,
				},
				Spec: query.QueryTypeSpec{
					Description: "classic",
					Versions: []query.QueryTypeVersion{
						{
							Schema: getPropsJSONSchema("github.com/grafana/grafana/pkg/apis/query/v0alpha1/expressions.ClassicQueryTypeProperties", ref),
							Examples: []query.ExampleInfo{
								{
									Name:        "resample example",
									Description: "adding two series",
									Query: query.GenericDataQuery{
										QueryType: "TODO.... use the map to set something reasonable",
									},
								},
							},
							Changelog: []string{
								"initial version",
							},
						},
					},
				},
			},
			{
				ObjectMeta: v1.ObjectMeta{
					Name: QueryTypeThreshold,
				},
				Spec: query.QueryTypeSpec{
					Description: "classic",
					Versions: []query.QueryTypeVersion{
						{
							Schema: getPropsJSONSchema("github.com/grafana/grafana/pkg/apis/query/v0alpha1/expressions.ThresholdQueryTypeProperties", ref),
							Examples: []query.ExampleInfo{
								{
									Name:        "threshold example",
									Description: "adding two series",
									Query: query.GenericDataQuery{
										QueryType: "TODO.... use the map to set something reasonable",
									},
								},
							},
							Changelog: []string{
								"initial version",
							},
						},
					},
				},
			},
		},
	}
}

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
