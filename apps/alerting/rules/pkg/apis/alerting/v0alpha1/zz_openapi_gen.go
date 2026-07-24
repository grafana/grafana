package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	common "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

func GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return map[string]common.OpenAPIDefinition{
		AlertRule{}.OpenAPIModelName():                                    schema_pkg_apis_alerting_v0alpha1_AlertRule(ref),
		AlertRuleExpression{}.OpenAPIModelName():                          schema_pkg_apis_alerting_v0alpha1_AlertRuleExpression(ref),
		AlertRuleIntervalTrigger{}.OpenAPIModelName():                     schema_pkg_apis_alerting_v0alpha1_AlertRuleIntervalTrigger(ref),
		AlertRuleList{}.OpenAPIModelName():                                schema_pkg_apis_alerting_v0alpha1_AlertRuleList(ref),
		AlertRuleNamedRoutingTree{}.OpenAPIModelName():                    schema_pkg_apis_alerting_v0alpha1_AlertRuleNamedRoutingTree(ref),
		AlertRulePanelRef{}.OpenAPIModelName():                            schema_pkg_apis_alerting_v0alpha1_AlertRulePanelRef(ref),
		AlertRuleRelativeTimeRange{}.OpenAPIModelName():                   schema_pkg_apis_alerting_v0alpha1_AlertRuleRelativeTimeRange(ref),
		AlertRuleSimplifiedRouting{}.OpenAPIModelName():                   schema_pkg_apis_alerting_v0alpha1_AlertRuleSimplifiedRouting(ref),
		AlertRuleSimplifiedRoutingOrNamedRoutingTree{}.OpenAPIModelName(): schema_pkg_apis_alerting_v0alpha1_AlertRuleSimplifiedRoutingOrNamedRoutingTree(ref),
		AlertRuleSpec{}.OpenAPIModelName():                                schema_pkg_apis_alerting_v0alpha1_AlertRuleSpec(ref),
		AlertRuleStatus{}.OpenAPIModelName():                              schema_pkg_apis_alerting_v0alpha1_AlertRuleStatus(ref),
		AlertRulestatusOperatorState{}.OpenAPIModelName():                 schema_pkg_apis_alerting_v0alpha1_AlertRulestatusOperatorState(ref),
		CreateSearchRulesBody{}.OpenAPIModelName():                        schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesBody(ref),
		CreateSearchRulesFacetValue{}.OpenAPIModelName():                  schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesFacetValue(ref),
		CreateSearchRulesResponse{}.OpenAPIModelName():                    schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesResponse(ref),
		CreateSearchRulesRuleSearchHitFields{}.OpenAPIModelName():         schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesRuleSearchHitFields(ref),
		CreateSearchRulesSearchResultHit{}.OpenAPIModelName():             schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesSearchResultHit(ref),
		CreateSearchRulesSearchResultResource{}.OpenAPIModelName():        schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesSearchResultResource(ref),
		CreateSearchRulesSearchResultsMetadata{}.OpenAPIModelName():       schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesSearchResultsMetadata(ref),
		RecordingRule{}.OpenAPIModelName():                                schema_pkg_apis_alerting_v0alpha1_RecordingRule(ref),
		RecordingRuleExpression{}.OpenAPIModelName():                      schema_pkg_apis_alerting_v0alpha1_RecordingRuleExpression(ref),
		RecordingRuleIntervalTrigger{}.OpenAPIModelName():                 schema_pkg_apis_alerting_v0alpha1_RecordingRuleIntervalTrigger(ref),
		RecordingRuleList{}.OpenAPIModelName():                            schema_pkg_apis_alerting_v0alpha1_RecordingRuleList(ref),
		RecordingRuleRelativeTimeRange{}.OpenAPIModelName():               schema_pkg_apis_alerting_v0alpha1_RecordingRuleRelativeTimeRange(ref),
		RecordingRuleSpec{}.OpenAPIModelName():                            schema_pkg_apis_alerting_v0alpha1_RecordingRuleSpec(ref),
		RecordingRuleStatus{}.OpenAPIModelName():                          schema_pkg_apis_alerting_v0alpha1_RecordingRuleStatus(ref),
		RecordingRulestatusOperatorState{}.OpenAPIModelName():             schema_pkg_apis_alerting_v0alpha1_RecordingRulestatusOperatorState(ref),
		RuleSequence{}.OpenAPIModelName():                                 schema_pkg_apis_alerting_v0alpha1_RuleSequence(ref),
		RuleSequenceIntervalTrigger{}.OpenAPIModelName():                  schema_pkg_apis_alerting_v0alpha1_RuleSequenceIntervalTrigger(ref),
		RuleSequenceList{}.OpenAPIModelName():                             schema_pkg_apis_alerting_v0alpha1_RuleSequenceList(ref),
		RuleSequenceRuleRef{}.OpenAPIModelName():                          schema_pkg_apis_alerting_v0alpha1_RuleSequenceRuleRef(ref),
		RuleSequenceSpec{}.OpenAPIModelName():                             schema_pkg_apis_alerting_v0alpha1_RuleSequenceSpec(ref),
		RuleSequenceStatus{}.OpenAPIModelName():                           schema_pkg_apis_alerting_v0alpha1_RuleSequenceStatus(ref),
		RuleSequencestatusOperatorState{}.OpenAPIModelName():              schema_pkg_apis_alerting_v0alpha1_RuleSequencestatusOperatorState(ref),
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRule(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Description: "Spec is the spec of the AlertRule",
							Default:     map[string]interface{}{},
							Ref:         ref(AlertRuleSpec{}.OpenAPIModelName()),
						},
					},
					"status": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(AlertRuleStatus{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec", "status"},
			},
		},
		Dependencies: []string{
			AlertRuleSpec{}.OpenAPIModelName(), AlertRuleStatus{}.OpenAPIModelName(), metav1.ObjectMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRuleExpression(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"queryType": {
						SchemaProps: spec.SchemaProps{
							Description: "The type of query if this is a query expression",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"relativeTimeRange": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(AlertRuleRelativeTimeRange{}.OpenAPIModelName()),
						},
					},
					"datasourceUID": {
						SchemaProps: spec.SchemaProps{
							Description: "The UID of the datasource to run this expression against. If omitted, the expression will be run against the `__expr__` datasource",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"model": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"object"},
							Format: "",
						},
					},
					"source": {
						SchemaProps: spec.SchemaProps{
							Description: "Used to mark the expression to be used as the final source for the rule evaluation Only one expression in a rule can be marked as the source For AlertRules, this is the expression that will be evaluated against the alerting condition For RecordingRules, this is the expression that will be recorded",
							Type:        []string{"boolean"},
							Format:      "",
						},
					},
				},
				Required: []string{"model"},
			},
		},
		Dependencies: []string{
			AlertRuleRelativeTimeRange{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRuleIntervalTrigger(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"interval": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"interval"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRuleList(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
										Ref:     ref(AlertRule{}.OpenAPIModelName()),
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
			AlertRule{}.OpenAPIModelName(), metav1.ListMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRuleNamedRoutingTree(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"type": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"routingTree": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"type", "routingTree"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRulePanelRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"dashboardUID": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"panelID": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"integer"},
							Format:  "int64",
						},
					},
				},
				Required: []string{"dashboardUID", "panelID"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRuleRelativeTimeRange(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"from": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"to": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"from", "to"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRuleSimplifiedRouting(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"type": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"receiver": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"groupBy": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
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
					"groupWait": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"groupInterval": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"repeatInterval": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"muteTimeIntervals": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
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
					"activeTimeIntervals": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
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
				},
				Required: []string{"type", "receiver"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRuleSimplifiedRoutingOrNamedRoutingTree(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"SimplifiedRouting": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(AlertRuleSimplifiedRouting{}.OpenAPIModelName()),
						},
					},
					"NamedRoutingTree": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(AlertRuleNamedRoutingTree{}.OpenAPIModelName()),
						},
					},
				},
			},
		},
		Dependencies: []string{
			AlertRuleNamedRoutingTree{}.OpenAPIModelName(), AlertRuleSimplifiedRouting{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRuleSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"title": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"paused": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"boolean"},
							Format: "",
						},
					},
					"trigger": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(AlertRuleIntervalTrigger{}.OpenAPIModelName()),
						},
					},
					"labels": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
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
					"annotations": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
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
					"for": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"keepFiringFor": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"missingSeriesEvalsToResolve": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"integer"},
							Format: "int64",
						},
					},
					"noDataState": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"execErrState": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"notificationSettings": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(AlertRuleSimplifiedRoutingOrNamedRoutingTree{}.OpenAPIModelName()),
						},
					},
					"expressions": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(AlertRuleExpression{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"panelRef": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(AlertRulePanelRef{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"title", "trigger", "noDataState", "execErrState", "expressions"},
			},
		},
		Dependencies: []string{
			AlertRuleExpression{}.OpenAPIModelName(), AlertRuleIntervalTrigger{}.OpenAPIModelName(), AlertRulePanelRef{}.OpenAPIModelName(), AlertRuleSimplifiedRoutingOrNamedRoutingTree{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRuleStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"health": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"lastEvaluationTime": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "date-time",
						},
					},
					"evaluationDuration": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"number"},
							Format: "double",
						},
					},
					"operatorStates": {
						SchemaProps: spec.SchemaProps{
							Description: "operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(AlertRulestatusOperatorState{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"lastError": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"additionalFields": {
						SchemaProps: spec.SchemaProps{
							Description: "additionalFields is reserved for future use",
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
				},
			},
		},
		Dependencies: []string{
			AlertRulestatusOperatorState{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRulestatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastEvaluation": {
						SchemaProps: spec.SchemaProps{
							Description: "lastEvaluation is the ResourceVersion last evaluated",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Description: "state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"descriptiveState": {
						SchemaProps: spec.SchemaProps{
							Description: "descriptiveState is an optional more descriptive state field which has no requirements on format",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"details": {
						SchemaProps: spec.SchemaProps{
							Description: "details contains any extra information that is operator-specific",
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
				},
				Required: []string{"lastEvaluation", "state"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesBody(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "listMeta is intentionally omitted: #SearchResults carries its own metadata (continue, totalHits) mirroring the generic search.grafana.app SearchResults envelope.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(CreateSearchRulesSearchResultsMetadata{}.OpenAPIModelName()),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(CreateSearchRulesSearchResultHit{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"facets": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type: []string{"array"},
										Items: &spec.SchemaOrArray{
											Schema: &spec.Schema{
												SchemaProps: spec.SchemaProps{
													Default: map[string]interface{}{},
													Ref:     ref(CreateSearchRulesFacetValue{}.OpenAPIModelName()),
												},
											},
										},
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
			CreateSearchRulesFacetValue{}.OpenAPIModelName(), CreateSearchRulesSearchResultHit{}.OpenAPIModelName(), CreateSearchRulesSearchResultsMetadata{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesFacetValue(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "#FacetValue is a single value/count pair in a facet breakdown.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"value": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"count": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"integer"},
							Format:  "int64",
						},
					},
				},
				Required: []string{"value", "count"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesResponse(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Ref:     ref(CreateSearchRulesSearchResultsMetadata{}.OpenAPIModelName()),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(CreateSearchRulesSearchResultHit{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"facets": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type: []string{"array"},
										Items: &spec.SchemaOrArray{
											Schema: &spec.Schema{
												SchemaProps: spec.SchemaProps{
													Default: map[string]interface{}{},
													Ref:     ref(CreateSearchRulesFacetValue{}.OpenAPIModelName()),
												},
											},
										},
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
			CreateSearchRulesFacetValue{}.OpenAPIModelName(), CreateSearchRulesSearchResultHit{}.OpenAPIModelName(), CreateSearchRulesSearchResultsMetadata{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesRuleSearchHitFields(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "#RuleSearchHitFields is the per-kind field payload returned on each hit. It carries the union of alert- and recording-rule search fields; only the fields relevant to a hit's kind are populated. This maps to the kind's declared searchFields.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"title": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"folder": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"type": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"interval": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"paused": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"boolean"},
							Format: "",
						},
					},
					"labels": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
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
					"datasourceUIDs": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
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
					"annotations": {
						SchemaProps: spec.SchemaProps{
							Description: "Alert-rule fields.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
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
					"for": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"keepFiringFor": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"dashboardUID": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"panelID": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"integer"},
							Format: "int64",
						},
					},
					"receiver": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"notificationType": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"routingTree": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"metric": {
						SchemaProps: spec.SchemaProps{
							Description: "Recording-rule fields.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"targetDatasourceUID": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
				},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesSearchResultHit(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "#SearchResultHit is a single match: its identity, an optional relevance score (present only when the query included free text), and the requested fields.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"resource": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(CreateSearchRulesSearchResultResource{}.OpenAPIModelName()),
						},
					},
					"score": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"number"},
							Format: "double",
						},
					},
					"fields": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(CreateSearchRulesRuleSearchHitFields{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"resource", "fields"},
			},
		},
		Dependencies: []string{
			CreateSearchRulesRuleSearchHitFields{}.OpenAPIModelName(), CreateSearchRulesSearchResultResource{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesSearchResultResource(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "#SearchResultResource is the full identity of a hit.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"group": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"resource": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"kind": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"name": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"group", "resource", "kind", "name"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_CreateSearchRulesSearchResultsMetadata(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "#SearchResultsMetadata carries the paging token and total authorised match count.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"continue": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"totalHits": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"integer"},
							Format: "int64",
						},
					},
				},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RecordingRule(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Description: "Spec is the spec of the RecordingRule",
							Default:     map[string]interface{}{},
							Ref:         ref(RecordingRuleSpec{}.OpenAPIModelName()),
						},
					},
					"status": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(RecordingRuleStatus{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec", "status"},
			},
		},
		Dependencies: []string{
			RecordingRuleSpec{}.OpenAPIModelName(), RecordingRuleStatus{}.OpenAPIModelName(), metav1.ObjectMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RecordingRuleExpression(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"queryType": {
						SchemaProps: spec.SchemaProps{
							Description: "The type of query if this is a query expression",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"relativeTimeRange": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(RecordingRuleRelativeTimeRange{}.OpenAPIModelName()),
						},
					},
					"datasourceUID": {
						SchemaProps: spec.SchemaProps{
							Description: "The UID of the datasource to run this expression against. If omitted, the expression will be run against the `__expr__` datasource",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"model": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"object"},
							Format: "",
						},
					},
					"source": {
						SchemaProps: spec.SchemaProps{
							Description: "Used to mark the expression to be used as the final source for the rule evaluation Only one expression in a rule can be marked as the source For AlertRules, this is the expression that will be evaluated against the alerting condition For RecordingRules, this is the expression that will be recorded",
							Type:        []string{"boolean"},
							Format:      "",
						},
					},
				},
				Required: []string{"model"},
			},
		},
		Dependencies: []string{
			RecordingRuleRelativeTimeRange{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RecordingRuleIntervalTrigger(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"interval": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"interval"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RecordingRuleList(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
										Ref:     ref(RecordingRule{}.OpenAPIModelName()),
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
			RecordingRule{}.OpenAPIModelName(), metav1.ListMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RecordingRuleRelativeTimeRange(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"from": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"to": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"from", "to"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RecordingRuleSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"title": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"paused": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"boolean"},
							Format: "",
						},
					},
					"trigger": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(RecordingRuleIntervalTrigger{}.OpenAPIModelName()),
						},
					},
					"labels": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
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
					"metric": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"expressions": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(RecordingRuleExpression{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"targetDatasourceUID": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"title", "trigger", "metric", "expressions", "targetDatasourceUID"},
			},
		},
		Dependencies: []string{
			RecordingRuleExpression{}.OpenAPIModelName(), RecordingRuleIntervalTrigger{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RecordingRuleStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"health": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"lastEvaluationTime": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "date-time",
						},
					},
					"evaluationTime": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"number"},
							Format: "double",
						},
					},
					"operatorStates": {
						SchemaProps: spec.SchemaProps{
							Description: "operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(RecordingRulestatusOperatorState{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"lastError": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"additionalFields": {
						SchemaProps: spec.SchemaProps{
							Description: "additionalFields is reserved for future use",
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
				},
			},
		},
		Dependencies: []string{
			RecordingRulestatusOperatorState{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RecordingRulestatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastEvaluation": {
						SchemaProps: spec.SchemaProps{
							Description: "lastEvaluation is the ResourceVersion last evaluated",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Description: "state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"descriptiveState": {
						SchemaProps: spec.SchemaProps{
							Description: "descriptiveState is an optional more descriptive state field which has no requirements on format",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"details": {
						SchemaProps: spec.SchemaProps{
							Description: "details contains any extra information that is operator-specific",
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
				},
				Required: []string{"lastEvaluation", "state"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RuleSequence(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Description: "Spec is the spec of the RuleSequence",
							Default:     map[string]interface{}{},
							Ref:         ref(RuleSequenceSpec{}.OpenAPIModelName()),
						},
					},
					"status": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(RuleSequenceStatus{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec", "status"},
			},
		},
		Dependencies: []string{
			RuleSequenceSpec{}.OpenAPIModelName(), RuleSequenceStatus{}.OpenAPIModelName(), metav1.ObjectMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RuleSequenceIntervalTrigger(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"interval": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"interval"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RuleSequenceList(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
										Ref:     ref(RuleSequence{}.OpenAPIModelName()),
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
			RuleSequence{}.OpenAPIModelName(), metav1.ListMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RuleSequenceRuleRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "name is the metadata.name of an AlertRule or RecordingRule resource.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"name"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RuleSequenceSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"trigger": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(RuleSequenceIntervalTrigger{}.OpenAPIModelName()),
						},
					},
					"recordingRules": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(RuleSequenceRuleRef{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"alertingRules": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(RuleSequenceRuleRef{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"trigger", "recordingRules"},
			},
		},
		Dependencies: []string{
			RuleSequenceIntervalTrigger{}.OpenAPIModelName(), RuleSequenceRuleRef{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RuleSequenceStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"operatorStates": {
						SchemaProps: spec.SchemaProps{
							Description: "operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(RuleSequencestatusOperatorState{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"additionalFields": {
						SchemaProps: spec.SchemaProps{
							Description: "additionalFields is reserved for future use",
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
				},
			},
		},
		Dependencies: []string{
			RuleSequencestatusOperatorState{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_RuleSequencestatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastEvaluation": {
						SchemaProps: spec.SchemaProps{
							Description: "lastEvaluation is the ResourceVersion last evaluated",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Description: "state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"descriptiveState": {
						SchemaProps: spec.SchemaProps{
							Description: "descriptiveState is an optional more descriptive state field which has no requirements on format",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"details": {
						SchemaProps: spec.SchemaProps{
							Description: "details contains any extra information that is operator-specific",
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
				},
				Required: []string{"lastEvaluation", "state"},
			},
		},
	}
}
