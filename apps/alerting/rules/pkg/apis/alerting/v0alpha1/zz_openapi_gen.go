package v0alpha1

import (
	alertingv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	common "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

func GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return map[string]common.OpenAPIDefinition{
		alertingv0alpha1.AlertRule{}.OpenAPIModelName():                                 schema_pkg_apis_alerting_v0alpha1_AlertRule(ref),
		alertingv0alpha1.AlertRuleExpression{}.OpenAPIModelName():                       schema_pkg_apis_alerting_v0alpha1_AlertRuleExpression(ref),
		alertingv0alpha1.AlertRuleIntervalTrigger{}.OpenAPIModelName():                  schema_pkg_apis_alerting_v0alpha1_AlertRuleIntervalTrigger(ref),
		alertingv0alpha1.AlertRuleList{}.OpenAPIModelName():                             schema_pkg_apis_alerting_v0alpha1_AlertRuleList(ref),
		alertingv0alpha1.AlertRuleRelativeTimeRange{}.OpenAPIModelName():                schema_pkg_apis_alerting_v0alpha1_AlertRuleRelativeTimeRange(ref),
		alertingv0alpha1.AlertRuleSpec{}.OpenAPIModelName():                             schema_pkg_apis_alerting_v0alpha1_AlertRuleSpec(ref),
		alertingv0alpha1.AlertRuleStatus{}.OpenAPIModelName():                           schema_pkg_apis_alerting_v0alpha1_AlertRuleStatus(ref),
		alertingv0alpha1.AlertRuleV0alpha1SpecNotificationSettings{}.OpenAPIModelName(): schema_pkg_apis_alerting_v0alpha1_AlertRuleV0alpha1SpecNotificationSettings(ref),
		alertingv0alpha1.AlertRuleV0alpha1SpecPanelRef{}.OpenAPIModelName():             schema_pkg_apis_alerting_v0alpha1_AlertRuleV0alpha1SpecPanelRef(ref),
		alertingv0alpha1.AlertRulestatusOperatorState{}.OpenAPIModelName():              schema_pkg_apis_alerting_v0alpha1_AlertRulestatusOperatorState(ref),
		alertingv0alpha1.RecordingRule{}.OpenAPIModelName():                             schema_pkg_apis_alerting_v0alpha1_RecordingRule(ref),
		alertingv0alpha1.RecordingRuleExpression{}.OpenAPIModelName():                   schema_pkg_apis_alerting_v0alpha1_RecordingRuleExpression(ref),
		alertingv0alpha1.RecordingRuleIntervalTrigger{}.OpenAPIModelName():              schema_pkg_apis_alerting_v0alpha1_RecordingRuleIntervalTrigger(ref),
		alertingv0alpha1.RecordingRuleList{}.OpenAPIModelName():                         schema_pkg_apis_alerting_v0alpha1_RecordingRuleList(ref),
		alertingv0alpha1.RecordingRuleRelativeTimeRange{}.OpenAPIModelName():            schema_pkg_apis_alerting_v0alpha1_RecordingRuleRelativeTimeRange(ref),
		alertingv0alpha1.RecordingRuleSpec{}.OpenAPIModelName():                         schema_pkg_apis_alerting_v0alpha1_RecordingRuleSpec(ref),
		alertingv0alpha1.RecordingRuleStatus{}.OpenAPIModelName():                       schema_pkg_apis_alerting_v0alpha1_RecordingRuleStatus(ref),
		alertingv0alpha1.RecordingRulestatusOperatorState{}.OpenAPIModelName():          schema_pkg_apis_alerting_v0alpha1_RecordingRulestatusOperatorState(ref),
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
							Ref:         ref(alertingv0alpha1.AlertRuleSpec{}.OpenAPIModelName()),
						},
					},
					"status": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(alertingv0alpha1.AlertRuleStatus{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec", "status"},
			},
		},
		Dependencies: []string{
			alertingv0alpha1.AlertRuleSpec{}.OpenAPIModelName(), alertingv0alpha1.AlertRuleStatus{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
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
							Ref: ref(alertingv0alpha1.AlertRuleRelativeTimeRange{}.OpenAPIModelName()),
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
			alertingv0alpha1.AlertRuleRelativeTimeRange{}.OpenAPIModelName()},
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
										Ref:     ref(alertingv0alpha1.AlertRule{}.OpenAPIModelName()),
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
			alertingv0alpha1.AlertRule{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
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
							Ref:     ref(alertingv0alpha1.AlertRuleIntervalTrigger{}.OpenAPIModelName()),
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
							Ref: ref(alertingv0alpha1.AlertRuleV0alpha1SpecNotificationSettings{}.OpenAPIModelName()),
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
										Ref:     ref(alertingv0alpha1.AlertRuleExpression{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"panelRef": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(alertingv0alpha1.AlertRuleV0alpha1SpecPanelRef{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"title", "trigger", "noDataState", "execErrState", "expressions"},
			},
		},
		Dependencies: []string{
			alertingv0alpha1.AlertRuleExpression{}.OpenAPIModelName(), alertingv0alpha1.AlertRuleIntervalTrigger{}.OpenAPIModelName(), alertingv0alpha1.AlertRuleV0alpha1SpecNotificationSettings{}.OpenAPIModelName(), alertingv0alpha1.AlertRuleV0alpha1SpecPanelRef{}.OpenAPIModelName()},
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
										Ref:     ref(alertingv0alpha1.AlertRulestatusOperatorState{}.OpenAPIModelName()),
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
			alertingv0alpha1.AlertRulestatusOperatorState{}.OpenAPIModelName()},
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
							Ref:         ref(alertingv0alpha1.RecordingRuleSpec{}.OpenAPIModelName()),
						},
					},
					"status": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(alertingv0alpha1.RecordingRuleStatus{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec", "status"},
			},
		},
		Dependencies: []string{
			alertingv0alpha1.RecordingRuleSpec{}.OpenAPIModelName(), alertingv0alpha1.RecordingRuleStatus{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
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
							Ref: ref(alertingv0alpha1.RecordingRuleRelativeTimeRange{}.OpenAPIModelName()),
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
			alertingv0alpha1.RecordingRuleRelativeTimeRange{}.OpenAPIModelName()},
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
										Ref:     ref(alertingv0alpha1.RecordingRule{}.OpenAPIModelName()),
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
			alertingv0alpha1.RecordingRule{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
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
							Ref:     ref(alertingv0alpha1.RecordingRuleIntervalTrigger{}.OpenAPIModelName()),
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
										Ref:     ref(alertingv0alpha1.RecordingRuleExpression{}.OpenAPIModelName()),
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
			alertingv0alpha1.RecordingRuleExpression{}.OpenAPIModelName(), alertingv0alpha1.RecordingRuleIntervalTrigger{}.OpenAPIModelName()},
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
										Ref:     ref(alertingv0alpha1.RecordingRulestatusOperatorState{}.OpenAPIModelName()),
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
			alertingv0alpha1.RecordingRulestatusOperatorState{}.OpenAPIModelName()},
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
