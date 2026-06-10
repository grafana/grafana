package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	common "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

func GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return map[string]common.OpenAPIDefinition{
		AlertRule{}.OpenAPIModelName():                                              schema_pkg_apis_alerting_v0alpha1_AlertRule(ref),
		AlertRuleExpression{}.OpenAPIModelName():                                    schema_pkg_apis_alerting_v0alpha1_AlertRuleExpression(ref),
		AlertRuleIntervalTrigger{}.OpenAPIModelName():                               schema_pkg_apis_alerting_v0alpha1_AlertRuleIntervalTrigger(ref),
		AlertRuleList{}.OpenAPIModelName():                                          schema_pkg_apis_alerting_v0alpha1_AlertRuleList(ref),
		AlertRuleNamedRoutingTree{}.OpenAPIModelName():                              schema_pkg_apis_alerting_v0alpha1_AlertRuleNamedRoutingTree(ref),
		AlertRulePanelRef{}.OpenAPIModelName():                                      schema_pkg_apis_alerting_v0alpha1_AlertRulePanelRef(ref),
		AlertRuleRelativeTimeRange{}.OpenAPIModelName():                             schema_pkg_apis_alerting_v0alpha1_AlertRuleRelativeTimeRange(ref),
		AlertRuleSimplifiedRouting{}.OpenAPIModelName():                             schema_pkg_apis_alerting_v0alpha1_AlertRuleSimplifiedRouting(ref),
		AlertRuleSimplifiedRoutingOrNamedRoutingTree{}.OpenAPIModelName():           schema_pkg_apis_alerting_v0alpha1_AlertRuleSimplifiedRoutingOrNamedRoutingTree(ref),
		AlertRuleSpec{}.OpenAPIModelName():                                          schema_pkg_apis_alerting_v0alpha1_AlertRuleSpec(ref),
		AlertRuleStatus{}.OpenAPIModelName():                                        schema_pkg_apis_alerting_v0alpha1_AlertRuleStatus(ref),
		AlertRulestatusOperatorState{}.OpenAPIModelName():                           schema_pkg_apis_alerting_v0alpha1_AlertRulestatusOperatorState(ref),
		GetSearchAlertRulesAlertRuleHit{}.OpenAPIModelName():                        schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesAlertRuleHit(ref),
		GetSearchAlertRulesAlertRuleSpec{}.OpenAPIModelName():                       schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesAlertRuleSpec(ref),
		GetSearchAlertRulesBody{}.OpenAPIModelName():                                schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesBody(ref),
		GetSearchAlertRulesExpression{}.OpenAPIModelName():                          schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesExpression(ref),
		GetSearchAlertRulesIntervalTrigger{}.OpenAPIModelName():                     schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesIntervalTrigger(ref),
		GetSearchAlertRulesNamedRoutingTree{}.OpenAPIModelName():                    schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesNamedRoutingTree(ref),
		GetSearchAlertRulesPanelRef{}.OpenAPIModelName():                            schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesPanelRef(ref),
		GetSearchAlertRulesRelativeTimeRange{}.OpenAPIModelName():                   schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesRelativeTimeRange(ref),
		GetSearchAlertRulesResponse{}.OpenAPIModelName():                            schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesResponse(ref),
		GetSearchAlertRulesSimplifiedRouting{}.OpenAPIModelName():                   schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesSimplifiedRouting(ref),
		GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree{}.OpenAPIModelName(): schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree(ref),
		GetSearchRecordingRulesBody{}.OpenAPIModelName():                            schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesBody(ref),
		GetSearchRecordingRulesExpression{}.OpenAPIModelName():                      schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesExpression(ref),
		GetSearchRecordingRulesIntervalTrigger{}.OpenAPIModelName():                 schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesIntervalTrigger(ref),
		GetSearchRecordingRulesRecordingRuleHit{}.OpenAPIModelName():                schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesRecordingRuleHit(ref),
		GetSearchRecordingRulesRecordingRuleSpec{}.OpenAPIModelName():               schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesRecordingRuleSpec(ref),
		GetSearchRecordingRulesRelativeTimeRange{}.OpenAPIModelName():               schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesRelativeTimeRange(ref),
		GetSearchRecordingRulesResponse{}.OpenAPIModelName():                        schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesResponse(ref),
		GetSearchRulesAlertRuleSpec{}.OpenAPIModelName():                            schema_pkg_apis_alerting_v0alpha1_GetSearchRulesAlertRuleSpec(ref),
		GetSearchRulesBody{}.OpenAPIModelName():                                     schema_pkg_apis_alerting_v0alpha1_GetSearchRulesBody(ref),
		GetSearchRulesExpression{}.OpenAPIModelName():                               schema_pkg_apis_alerting_v0alpha1_GetSearchRulesExpression(ref),
		GetSearchRulesIntervalTrigger{}.OpenAPIModelName():                          schema_pkg_apis_alerting_v0alpha1_GetSearchRulesIntervalTrigger(ref),
		GetSearchRulesNamedRoutingTree{}.OpenAPIModelName():                         schema_pkg_apis_alerting_v0alpha1_GetSearchRulesNamedRoutingTree(ref),
		GetSearchRulesPanelRef{}.OpenAPIModelName():                                 schema_pkg_apis_alerting_v0alpha1_GetSearchRulesPanelRef(ref),
		GetSearchRulesRecordingRuleSpec{}.OpenAPIModelName():                        schema_pkg_apis_alerting_v0alpha1_GetSearchRulesRecordingRuleSpec(ref),
		GetSearchRulesRelativeTimeRange{}.OpenAPIModelName():                        schema_pkg_apis_alerting_v0alpha1_GetSearchRulesRelativeTimeRange(ref),
		GetSearchRulesResponse{}.OpenAPIModelName():                                 schema_pkg_apis_alerting_v0alpha1_GetSearchRulesResponse(ref),
		GetSearchRulesRuleHit{}.OpenAPIModelName():                                  schema_pkg_apis_alerting_v0alpha1_GetSearchRulesRuleHit(ref),
		GetSearchRulesSimplifiedRouting{}.OpenAPIModelName():                        schema_pkg_apis_alerting_v0alpha1_GetSearchRulesSimplifiedRouting(ref),
		GetSearchRulesSimplifiedRoutingOrNamedRoutingTree{}.OpenAPIModelName():      schema_pkg_apis_alerting_v0alpha1_GetSearchRulesSimplifiedRoutingOrNamedRoutingTree(ref),
		RecordingRule{}.OpenAPIModelName():                                          schema_pkg_apis_alerting_v0alpha1_RecordingRule(ref),
		RecordingRuleExpression{}.OpenAPIModelName():                                schema_pkg_apis_alerting_v0alpha1_RecordingRuleExpression(ref),
		RecordingRuleIntervalTrigger{}.OpenAPIModelName():                           schema_pkg_apis_alerting_v0alpha1_RecordingRuleIntervalTrigger(ref),
		RecordingRuleList{}.OpenAPIModelName():                                      schema_pkg_apis_alerting_v0alpha1_RecordingRuleList(ref),
		RecordingRuleRelativeTimeRange{}.OpenAPIModelName():                         schema_pkg_apis_alerting_v0alpha1_RecordingRuleRelativeTimeRange(ref),
		RecordingRuleSpec{}.OpenAPIModelName():                                      schema_pkg_apis_alerting_v0alpha1_RecordingRuleSpec(ref),
		RecordingRuleStatus{}.OpenAPIModelName():                                    schema_pkg_apis_alerting_v0alpha1_RecordingRuleStatus(ref),
		RecordingRulestatusOperatorState{}.OpenAPIModelName():                       schema_pkg_apis_alerting_v0alpha1_RecordingRulestatusOperatorState(ref),
		RuleSequence{}.OpenAPIModelName():                                           schema_pkg_apis_alerting_v0alpha1_RuleSequence(ref),
		RuleSequenceIntervalTrigger{}.OpenAPIModelName():                            schema_pkg_apis_alerting_v0alpha1_RuleSequenceIntervalTrigger(ref),
		RuleSequenceList{}.OpenAPIModelName():                                       schema_pkg_apis_alerting_v0alpha1_RuleSequenceList(ref),
		RuleSequenceRuleRef{}.OpenAPIModelName():                                    schema_pkg_apis_alerting_v0alpha1_RuleSequenceRuleRef(ref),
		RuleSequenceSpec{}.OpenAPIModelName():                                       schema_pkg_apis_alerting_v0alpha1_RuleSequenceSpec(ref),
		RuleSequenceStatus{}.OpenAPIModelName():                                     schema_pkg_apis_alerting_v0alpha1_RuleSequenceStatus(ref),
		RuleSequencestatusOperatorState{}.OpenAPIModelName():                        schema_pkg_apis_alerting_v0alpha1_RuleSequencestatusOperatorState(ref),
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
							Type:   []string{"string"},
							Format: "",
						},
					},
					"relativeTimeRange": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(AlertRuleRelativeTimeRange{}.OpenAPIModelName()),
						},
					},
					"datasourceUID": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
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
							Type:   []string{"boolean"},
							Format: "",
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesAlertRuleHit(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"object"},
							Format: "",
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(GetSearchAlertRulesAlertRuleSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			GetSearchAlertRulesAlertRuleSpec{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesAlertRuleSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Ref:     ref(GetSearchAlertRulesIntervalTrigger{}.OpenAPIModelName()),
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
							Ref: ref(GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree{}.OpenAPIModelName()),
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
										Ref:     ref(GetSearchAlertRulesExpression{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"panelRef": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(GetSearchAlertRulesPanelRef{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"title", "trigger", "noDataState", "execErrState", "expressions"},
			},
		},
		Dependencies: []string{
			GetSearchAlertRulesExpression{}.OpenAPIModelName(), GetSearchAlertRulesIntervalTrigger{}.OpenAPIModelName(), GetSearchAlertRulesPanelRef{}.OpenAPIModelName(), GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesBody(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(GetSearchAlertRulesAlertRuleHit{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"items"},
			},
		},
		Dependencies: []string{
			GetSearchAlertRulesAlertRuleHit{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesExpression(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"queryType": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"relativeTimeRange": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(GetSearchAlertRulesRelativeTimeRange{}.OpenAPIModelName()),
						},
					},
					"datasourceUID": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
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
							Type:   []string{"boolean"},
							Format: "",
						},
					},
				},
				Required: []string{"model"},
			},
		},
		Dependencies: []string{
			GetSearchAlertRulesRelativeTimeRange{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesIntervalTrigger(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesNamedRoutingTree(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesPanelRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesRelativeTimeRange(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesResponse(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
										Ref:     ref(GetSearchAlertRulesAlertRuleHit{}.OpenAPIModelName()),
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
			GetSearchAlertRulesAlertRuleHit{}.OpenAPIModelName(), metav1.ListMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesSimplifiedRouting(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"SimplifiedRouting": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(GetSearchAlertRulesSimplifiedRouting{}.OpenAPIModelName()),
						},
					},
					"NamedRoutingTree": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(GetSearchAlertRulesNamedRoutingTree{}.OpenAPIModelName()),
						},
					},
				},
			},
		},
		Dependencies: []string{
			GetSearchAlertRulesNamedRoutingTree{}.OpenAPIModelName(), GetSearchAlertRulesSimplifiedRouting{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesBody(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(GetSearchRecordingRulesRecordingRuleHit{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"items"},
			},
		},
		Dependencies: []string{
			GetSearchRecordingRulesRecordingRuleHit{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesExpression(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"queryType": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"relativeTimeRange": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(GetSearchRecordingRulesRelativeTimeRange{}.OpenAPIModelName()),
						},
					},
					"datasourceUID": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
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
							Type:   []string{"boolean"},
							Format: "",
						},
					},
				},
				Required: []string{"model"},
			},
		},
		Dependencies: []string{
			GetSearchRecordingRulesRelativeTimeRange{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesIntervalTrigger(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesRecordingRuleHit(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"object"},
							Format: "",
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(GetSearchRecordingRulesRecordingRuleSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			GetSearchRecordingRulesRecordingRuleSpec{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesRecordingRuleSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Ref:     ref(GetSearchRecordingRulesIntervalTrigger{}.OpenAPIModelName()),
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
										Ref:     ref(GetSearchRecordingRulesExpression{}.OpenAPIModelName()),
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
			GetSearchRecordingRulesExpression{}.OpenAPIModelName(), GetSearchRecordingRulesIntervalTrigger{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesRelativeTimeRange(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchRecordingRulesResponse(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
										Ref:     ref(GetSearchRecordingRulesRecordingRuleHit{}.OpenAPIModelName()),
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
			GetSearchRecordingRulesRecordingRuleHit{}.OpenAPIModelName(), metav1.ListMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchRulesAlertRuleSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Ref:     ref(GetSearchRulesIntervalTrigger{}.OpenAPIModelName()),
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
							Ref: ref(GetSearchRulesSimplifiedRoutingOrNamedRoutingTree{}.OpenAPIModelName()),
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
										Ref:     ref(GetSearchRulesExpression{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"panelRef": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(GetSearchRulesPanelRef{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"title", "trigger", "noDataState", "execErrState", "expressions"},
			},
		},
		Dependencies: []string{
			GetSearchRulesExpression{}.OpenAPIModelName(), GetSearchRulesIntervalTrigger{}.OpenAPIModelName(), GetSearchRulesPanelRef{}.OpenAPIModelName(), GetSearchRulesSimplifiedRoutingOrNamedRoutingTree{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchRulesBody(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(GetSearchRulesRuleHit{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"items"},
			},
		},
		Dependencies: []string{
			GetSearchRulesRuleHit{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchRulesExpression(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"queryType": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
						},
					},
					"relativeTimeRange": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(GetSearchRulesRelativeTimeRange{}.OpenAPIModelName()),
						},
					},
					"datasourceUID": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
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
							Type:   []string{"boolean"},
							Format: "",
						},
					},
				},
				Required: []string{"model"},
			},
		},
		Dependencies: []string{
			GetSearchRulesRelativeTimeRange{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchRulesIntervalTrigger(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchRulesNamedRoutingTree(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchRulesPanelRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchRulesRecordingRuleSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Ref:     ref(GetSearchRulesIntervalTrigger{}.OpenAPIModelName()),
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
										Ref:     ref(GetSearchRulesExpression{}.OpenAPIModelName()),
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
			GetSearchRulesExpression{}.OpenAPIModelName(), GetSearchRulesIntervalTrigger{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchRulesRelativeTimeRange(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchRulesResponse(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
										Ref:     ref(GetSearchRulesRuleHit{}.OpenAPIModelName()),
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
			GetSearchRulesRuleHit{}.OpenAPIModelName(), metav1.ListMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchRulesRuleHit(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"object"},
							Format: "",
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"object"},
							Format: "",
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_GetSearchRulesSimplifiedRouting(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_alerting_v0alpha1_GetSearchRulesSimplifiedRoutingOrNamedRoutingTree(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"SimplifiedRouting": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(GetSearchRulesSimplifiedRouting{}.OpenAPIModelName()),
						},
					},
					"NamedRoutingTree": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(GetSearchRulesNamedRoutingTree{}.OpenAPIModelName()),
						},
					},
				},
			},
		},
		Dependencies: []string{
			GetSearchRulesNamedRoutingTree{}.OpenAPIModelName(), GetSearchRulesSimplifiedRouting{}.OpenAPIModelName()},
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
							Type:   []string{"string"},
							Format: "",
						},
					},
					"relativeTimeRange": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(RecordingRuleRelativeTimeRange{}.OpenAPIModelName()),
						},
					},
					"datasourceUID": {
						SchemaProps: spec.SchemaProps{
							Type:   []string{"string"},
							Format: "",
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
							Type:   []string{"boolean"},
							Format: "",
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
							Default: "",
							Type:    []string{"string"},
							Format:  "",
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
