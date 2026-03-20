package v0alpha1

import (
	common "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

func GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return map[string]common.OpenAPIDefinition{
		AlertRule{}.OpenAPIModelName():                                 schema_pkg_apis_alerting_v0alpha1_AlertRule(ref),
		AlertRuleExpression{}.OpenAPIModelName():                       schema_pkg_apis_alerting_v0alpha1_AlertRuleExpression(ref),
		AlertRuleIntervalTrigger{}.OpenAPIModelName():                  schema_pkg_apis_alerting_v0alpha1_AlertRuleIntervalTrigger(ref),
		AlertRuleList{}.OpenAPIModelName():                             schema_pkg_apis_alerting_v0alpha1_AlertRuleList(ref),
		AlertRuleRelativeTimeRange{}.OpenAPIModelName():                schema_pkg_apis_alerting_v0alpha1_AlertRuleRelativeTimeRange(ref),
		AlertRuleSpec{}.OpenAPIModelName():                             schema_pkg_apis_alerting_v0alpha1_AlertRuleSpec(ref),
		AlertRuleStatus{}.OpenAPIModelName():                           schema_pkg_apis_alerting_v0alpha1_AlertRuleStatus(ref),
		AlertRuleV0alpha1SpecNotificationSettings{}.OpenAPIModelName(): schema_pkg_apis_alerting_v0alpha1_AlertRuleV0alpha1SpecNotificationSettings(ref),
		AlertRuleV0alpha1SpecPanelRef{}.OpenAPIModelName():             schema_pkg_apis_alerting_v0alpha1_AlertRuleV0alpha1SpecPanelRef(ref),
		AlertRulestatusOperatorState{}.OpenAPIModelName():              schema_pkg_apis_alerting_v0alpha1_AlertRulestatusOperatorState(ref),
		RecordingRule{}.OpenAPIModelName():                             schema_pkg_apis_alerting_v0alpha1_RecordingRule(ref),
		RecordingRuleExpression{}.OpenAPIModelName():                   schema_pkg_apis_alerting_v0alpha1_RecordingRuleExpression(ref),
		RecordingRuleIntervalTrigger{}.OpenAPIModelName():              schema_pkg_apis_alerting_v0alpha1_RecordingRuleIntervalTrigger(ref),
		RecordingRuleList{}.OpenAPIModelName():                         schema_pkg_apis_alerting_v0alpha1_RecordingRuleList(ref),
		RecordingRuleRelativeTimeRange{}.OpenAPIModelName():            schema_pkg_apis_alerting_v0alpha1_RecordingRuleRelativeTimeRange(ref),
		RecordingRuleSpec{}.OpenAPIModelName():                         schema_pkg_apis_alerting_v0alpha1_RecordingRuleSpec(ref),
		RecordingRuleStatus{}.OpenAPIModelName():                       schema_pkg_apis_alerting_v0alpha1_RecordingRuleStatus(ref),
		RecordingRulestatusOperatorState{}.OpenAPIModelName():          schema_pkg_apis_alerting_v0alpha1_RecordingRulestatusOperatorState(ref),
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
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
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
			AlertRuleSpec{}.OpenAPIModelName(), AlertRuleStatus{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
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
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
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
			AlertRule{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
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
							Ref: ref(AlertRuleV0alpha1SpecNotificationSettings{}.OpenAPIModelName()),
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
							Ref: ref(AlertRuleV0alpha1SpecPanelRef{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"title", "trigger", "noDataState", "execErrState", "expressions"},
			},
		},
		Dependencies: []string{
			AlertRuleExpression{}.OpenAPIModelName(), AlertRuleIntervalTrigger{}.OpenAPIModelName(), AlertRuleV0alpha1SpecNotificationSettings{}.OpenAPIModelName(), AlertRuleV0alpha1SpecPanelRef{}.OpenAPIModelName()},
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

func schema_pkg_apis_alerting_v0alpha1_AlertRuleV0alpha1SpecNotificationSettings(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
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
				Required: []string{"receiver"},
			},
		},
	}
}

func schema_pkg_apis_alerting_v0alpha1_AlertRuleV0alpha1SpecPanelRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
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
			RecordingRuleSpec{}.OpenAPIModelName(), RecordingRuleStatus{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
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
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
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
			RecordingRule{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
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
