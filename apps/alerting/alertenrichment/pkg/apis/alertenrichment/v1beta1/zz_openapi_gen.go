package v1beta1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	common "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

func GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return map[string]common.OpenAPIDefinition{
		AlertEnrichment{}.OpenAPIModelName():                    schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichment(ref),
		AlertEnrichmentAssignEnricher{}.OpenAPIModelName():      schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentAssignEnricher(ref),
		AlertEnrichmentAssignment{}.OpenAPIModelName():          schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentAssignment(ref),
		AlertEnrichmentCondition{}.OpenAPIModelName():           schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentCondition(ref),
		AlertEnrichmentConditional{}.OpenAPIModelName():         schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentConditional(ref),
		AlertEnrichmentDataSourceEnricher{}.OpenAPIModelName():  schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentDataSourceEnricher(ref),
		AlertEnrichmentEnricherConfig{}.OpenAPIModelName():      schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentEnricherConfig(ref),
		AlertEnrichmentExplainEnricher{}.OpenAPIModelName():     schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentExplainEnricher(ref),
		AlertEnrichmentExternalEnricher{}.OpenAPIModelName():    schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentExternalEnricher(ref),
		AlertEnrichmentList{}.OpenAPIModelName():                schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentList(ref),
		AlertEnrichmentLogsDataSourceQuery{}.OpenAPIModelName(): schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentLogsDataSourceQuery(ref),
		AlertEnrichmentMatcher{}.OpenAPIModelName():             schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentMatcher(ref),
		AlertEnrichmentRawDataSourceQuery{}.OpenAPIModelName():  schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentRawDataSourceQuery(ref),
		AlertEnrichmentSpec{}.OpenAPIModelName():                schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentSpec(ref),
		AlertEnrichmentStep{}.OpenAPIModelName():                schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentStep(ref),
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichment(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(metav1.ObjectMeta{}.OpenAPIModelName()),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the AlertEnrichment",
							Default:     map[string]interface{}{},
							Ref:         ref(AlertEnrichmentSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			AlertEnrichmentSpec{}.OpenAPIModelName(), metav1.ObjectMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentAssignEnricher(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "AssignEnricher configures an enricher which assigns annotations.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"annotations": {
						SchemaProps: spec.SchemaProps{
							Description: "Annotations to change and values to set them to.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(AlertEnrichmentAssignment{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"annotations"},
			},
		},
		Dependencies: []string{
			AlertEnrichmentAssignment{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentAssignment(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "Name of the annotation to assign.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"value": {
						SchemaProps: spec.SchemaProps{
							Description: "Value to assign to the annotation. Can use Go template format, with access to annotations and labels via e.g. {{$annotations.x}}",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"name", "value"},
			},
		},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentCondition(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"labelMatchers": {
						SchemaProps: spec.SchemaProps{
							Description: "LabelMatchers optionally specifies the condition to require matching label values.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(AlertEnrichmentMatcher{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"annotationMatchers": {
						SchemaProps: spec.SchemaProps{
							Description: "AnnotationMatchers optionally restricts when the per-alert enrichments are run.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(AlertEnrichmentMatcher{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"dataSourceQuery": {
						SchemaProps: spec.SchemaProps{
							Description: "DataSourceQuery is a data source query to run. If the query returns a non-zero value, then the condition is taken to be true.",
							Ref:         ref(AlertEnrichmentRawDataSourceQuery{}.OpenAPIModelName()),
						},
					},
				},
			},
		},
		Dependencies: []string{
			AlertEnrichmentMatcher{}.OpenAPIModelName(), AlertEnrichmentRawDataSourceQuery{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentConditional(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"if": {
						SchemaProps: spec.SchemaProps{
							Description: "If is the condition to evaluate.",
							Default:     map[string]interface{}{},
							Ref:         ref(AlertEnrichmentCondition{}.OpenAPIModelName()),
						},
					},
					"then": {
						SchemaProps: spec.SchemaProps{
							Description: "Then is the enrichment steps to perform if all the conditions above are true.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(AlertEnrichmentStep{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"else": {
						SchemaProps: spec.SchemaProps{
							Description: "Else is the enrichment steps to perform otherwise.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(AlertEnrichmentStep{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"if", "then"},
			},
		},
		Dependencies: []string{
			AlertEnrichmentCondition{}.OpenAPIModelName(), AlertEnrichmentStep{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentDataSourceEnricher(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "DataSourceEnricher configures an enricher which calls an external service.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"type": {
						SchemaProps: spec.SchemaProps{
							Description: "Data source query type",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"raw": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(AlertEnrichmentRawDataSourceQuery{}.OpenAPIModelName()),
						},
					},
					"logs": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(AlertEnrichmentLogsDataSourceQuery{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"type"},
			},
		},
		Dependencies: []string{
			AlertEnrichmentLogsDataSourceQuery{}.OpenAPIModelName(), AlertEnrichmentRawDataSourceQuery{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentEnricherConfig(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "EnricherConfig is a discriminated union of enricher configurations.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"type": {
						SchemaProps: spec.SchemaProps{
							Description: "Enricher type",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"assign": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(AlertEnrichmentAssignEnricher{}.OpenAPIModelName()),
						},
					},
					"external": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(AlertEnrichmentExternalEnricher{}.OpenAPIModelName()),
						},
					},
					"dataSource": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(AlertEnrichmentDataSourceEnricher{}.OpenAPIModelName()),
						},
					},
					"sift": {
						SchemaProps: spec.SchemaProps{},
					},
					"asserts": {
						SchemaProps: spec.SchemaProps{},
					},
					"explain": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(AlertEnrichmentExplainEnricher{}.OpenAPIModelName()),
						},
					},
					"loop": {
						SchemaProps: spec.SchemaProps{},
					},
					"assistant": {
						SchemaProps: spec.SchemaProps{},
					},
					"querySample": {
						SchemaProps: spec.SchemaProps{},
					},
				},
				Required: []string{"type"},
			},
		},
		Dependencies: []string{
			AlertEnrichmentAssignEnricher{}.OpenAPIModelName(), AlertEnrichmentDataSourceEnricher{}.OpenAPIModelName(), AlertEnrichmentExplainEnricher{}.OpenAPIModelName(), AlertEnrichmentExternalEnricher{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentExplainEnricher(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "ExplainEnricher uses LLM to generate explanations for alerts.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"annotation": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"annotation"},
			},
		},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentExternalEnricher(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "ExternalEnricher configures an enricher which calls an external service.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"url": {
						SchemaProps: spec.SchemaProps{
							Description: "URL of the external HTTP service to call out to.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"url"},
			},
		},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(metav1.ListMeta{}.OpenAPIModelName()),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(AlertEnrichment{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			AlertEnrichment{}.OpenAPIModelName(), metav1.ListMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentLogsDataSourceQuery(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "LogsDataSourceQuery is a simplified method of describing a logs query, typically those that return data frames with a \"Line\" field.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"dataSourceType": {
						SchemaProps: spec.SchemaProps{
							Description: "The datasource plugin type",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"dataSourceUid": {
						SchemaProps: spec.SchemaProps{
							Description: "Datasource UID",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"expr": {
						SchemaProps: spec.SchemaProps{
							Description: "The logs query to run.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"maxLines": {
						SchemaProps: spec.SchemaProps{
							Description: "Number of log lines to add to the alert. Defaults to 3.",
							Type:        []string{"integer"},
							Format:      "int64",
						},
					},
				},
				Required: []string{"dataSourceType", "expr"},
			},
		},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentMatcher(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "Matcher is used to match label (or annotation) values.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"type": {
						SchemaProps: spec.SchemaProps{
							Description: "Comparison operator",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"name": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"value": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"type", "name", "value"},
			},
		},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentRawDataSourceQuery(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "RawDataSourceQuery allows defining the entire query request",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"request": {
						SchemaProps: spec.SchemaProps{
							Description: "The data source request to perform.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
					"refId": {
						SchemaProps: spec.SchemaProps{
							Description: "The RefID of the response to use. Not required if only a single query is given.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
			},
		},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"title": {
						SchemaProps: spec.SchemaProps{
							Description: "Title of the alert enrichment.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"description": {
						SchemaProps: spec.SchemaProps{
							Description: "Description of the alert enrichment.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"alertRuleUids": {
						SchemaProps: spec.SchemaProps{
							Description: "Alert rules for which to run the enrichment for. If not set, the enrichment runs for all alert rules.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: "",
										Type:    []string{"string"},
										Format:  "",
									},
								},
							},
						},
					},
					"labelMatchers": {
						SchemaProps: spec.SchemaProps{
							Description: "LabelMatchers optionally restricts when this enrichment runs.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(AlertEnrichmentMatcher{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"annotationMatchers": {
						SchemaProps: spec.SchemaProps{
							Description: "AnnotationMatchers optionally restricts when this enrichment runs.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(AlertEnrichmentMatcher{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"receivers": {
						SchemaProps: spec.SchemaProps{
							Description: "Receivers optionally restricts the enrichment to one or more receiver names. If not set, the enrichment runs for alerts coming from all receivers.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: "",
										Type:    []string{"string"},
										Format:  "",
									},
								},
							},
						},
					},
					"steps": {
						SchemaProps: spec.SchemaProps{
							Description: "Steps of the enrichment pipeline.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(AlertEnrichmentStep{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"title", "steps"},
			},
		},
		Dependencies: []string{
			AlertEnrichmentMatcher{}.OpenAPIModelName(), AlertEnrichmentStep{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alertenrichment_v1beta1_AlertEnrichmentStep(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "Step represent an invocation of a single enricher.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"type": {
						SchemaProps: spec.SchemaProps{
							Description: "Step kind: 'enricher' or 'conditional'",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"timeout": {
						SchemaProps: spec.SchemaProps{
							Description: "Timeout is the maximum about of time this specific enrichment is allowed to take. Accepts a Go duration string (e.g. \"5s\", \"1m30s\", \"500ms\").",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"enricher": {
						SchemaProps: spec.SchemaProps{
							Description: "Enricher specifies what enricher to run and it's configuration.",
							Ref:         ref(AlertEnrichmentEnricherConfig{}.OpenAPIModelName()),
						},
					},
					"conditional": {
						SchemaProps: spec.SchemaProps{
							Description: "Conditional allows branching to specifies what enricher to run and it's configuration.",
							Ref:         ref(AlertEnrichmentConditional{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"type", "timeout"},
			},
		},
		Dependencies: []string{
			AlertEnrichmentConditional{}.OpenAPIModelName(), AlertEnrichmentEnricherConfig{}.OpenAPIModelName()},
	}
}
