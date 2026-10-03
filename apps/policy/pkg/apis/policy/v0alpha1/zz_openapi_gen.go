package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	common "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

func GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return map[string]common.OpenAPIDefinition{
		ValidationPolicy{}.OpenAPIModelName():                           schema_pkg_apis_policy_v0alpha1_ValidationPolicy(ref),
		ValidationPolicyBinding{}.OpenAPIModelName():                    schema_pkg_apis_policy_v0alpha1_ValidationPolicyBinding(ref),
		ValidationPolicyBindingList{}.OpenAPIModelName():                schema_pkg_apis_policy_v0alpha1_ValidationPolicyBindingList(ref),
		ValidationPolicyBindingParamRef{}.OpenAPIModelName():            schema_pkg_apis_policy_v0alpha1_ValidationPolicyBindingParamRef(ref),
		ValidationPolicyBindingSpec{}.OpenAPIModelName():                schema_pkg_apis_policy_v0alpha1_ValidationPolicyBindingSpec(ref),
		ValidationPolicyBindingStatus{}.OpenAPIModelName():              schema_pkg_apis_policy_v0alpha1_ValidationPolicyBindingStatus(ref),
		ValidationPolicyBindingstatusOperatorState{}.OpenAPIModelName(): schema_pkg_apis_policy_v0alpha1_ValidationPolicyBindingstatusOperatorState(ref),
		ValidationPolicyList{}.OpenAPIModelName():                       schema_pkg_apis_policy_v0alpha1_ValidationPolicyList(ref),
		ValidationPolicyNamedExpression{}.OpenAPIModelName():            schema_pkg_apis_policy_v0alpha1_ValidationPolicyNamedExpression(ref),
		ValidationPolicyParamKind{}.OpenAPIModelName():                  schema_pkg_apis_policy_v0alpha1_ValidationPolicyParamKind(ref),
		ValidationPolicyResourceMatch{}.OpenAPIModelName():              schema_pkg_apis_policy_v0alpha1_ValidationPolicyResourceMatch(ref),
		ValidationPolicySpec{}.OpenAPIModelName():                       schema_pkg_apis_policy_v0alpha1_ValidationPolicySpec(ref),
		ValidationPolicyStatus{}.OpenAPIModelName():                     schema_pkg_apis_policy_v0alpha1_ValidationPolicyStatus(ref),
		ValidationPolicyValidation{}.OpenAPIModelName():                 schema_pkg_apis_policy_v0alpha1_ValidationPolicyValidation(ref),
		ValidationPolicystatusOperatorState{}.OpenAPIModelName():        schema_pkg_apis_policy_v0alpha1_ValidationPolicystatusOperatorState(ref),
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicy(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Description: "Spec is the spec of the ValidationPolicy",
							Default:     map[string]interface{}{},
							Ref:         ref(ValidationPolicySpec{}.OpenAPIModelName()),
						},
					},
					"status": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(ValidationPolicyStatus{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec", "status"},
			},
		},
		Dependencies: []string{
			ValidationPolicySpec{}.OpenAPIModelName(), ValidationPolicyStatus{}.OpenAPIModelName(), metav1.ObjectMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicyBinding(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Description: "Spec is the spec of the ValidationPolicyBinding",
							Default:     map[string]interface{}{},
							Ref:         ref(ValidationPolicyBindingSpec{}.OpenAPIModelName()),
						},
					},
					"status": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(ValidationPolicyBindingStatus{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec", "status"},
			},
		},
		Dependencies: []string{
			ValidationPolicyBindingSpec{}.OpenAPIModelName(), ValidationPolicyBindingStatus{}.OpenAPIModelName(), metav1.ObjectMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicyBindingList(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
										Ref: ref(ValidationPolicyBinding{}.OpenAPIModelName()),
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
			ValidationPolicyBinding{}.OpenAPIModelName(), metav1.ListMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicyBindingParamRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_policy_v0alpha1_ValidationPolicyBindingSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"policyName": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"actions": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"string"},
										Format: "",
									},
								},
							},
						},
					},
					"paramRef": {
						SchemaProps: spec.SchemaProps{
							Description: "Selects the parameter object, in the same namespace. Required when the policy declares a paramKind. When the object does not exist, the binding does not apply.",
							Ref:         ref(ValidationPolicyBindingParamRef{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"policyName", "actions"},
			},
		},
		Dependencies: []string{
			ValidationPolicyBindingParamRef{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicyBindingStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
										Ref: ref(ValidationPolicyBindingstatusOperatorState{}.OpenAPIModelName()),
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
			ValidationPolicyBindingstatusOperatorState{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicyBindingstatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_policy_v0alpha1_ValidationPolicyList(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
										Ref: ref(ValidationPolicy{}.OpenAPIModelName()),
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
			ValidationPolicy{}.OpenAPIModelName(), metav1.ListMeta{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicyNamedExpression(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
					"expression": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"name", "expression"},
			},
		},
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicyParamKind(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"group": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"version": {
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
				},
				Required: []string{"group", "version", "kind"},
			},
		},
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicyResourceMatch(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"group": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"versions": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"string"},
										Format: "",
									},
								},
							},
						},
					},
					"kinds": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"string"},
										Format: "",
									},
								},
							},
						},
					},
					"operations": {
						SchemaProps: spec.SchemaProps{
							Description: "Defaults to CREATE and UPDATE.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"string"},
										Format: "",
									},
								},
							},
						},
					},
				},
				Required: []string{"group", "versions", "kinds"},
			},
		},
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicySpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"match": {
						SchemaProps: spec.SchemaProps{
							Description: "Selects the resources the policy applies to. The policy is type-checked against the schema of every kind and version it matches.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Ref: ref(ValidationPolicyResourceMatch{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"matchConditions": {
						SchemaProps: spec.SchemaProps{
							Description: "Further filters matched resources. All conditions must be true for the policy to apply.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Ref: ref(ValidationPolicyNamedExpression{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"variables": {
						SchemaProps: spec.SchemaProps{
							Description: "Named expressions available as variables.<name> to later variables, match conditions and validations.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Ref: ref(ValidationPolicyNamedExpression{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"validations": {
						SchemaProps: spec.SchemaProps{
							Description: "The rules a matched resource must satisfy.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Ref: ref(ValidationPolicyValidation{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"failurePolicy": {
						SchemaProps: spec.SchemaProps{
							Description: "How evaluation errors are treated. Fail treats them as violations; Ignore drops them.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"paramKind": {
						SchemaProps: spec.SchemaProps{
							Description: "The kind of the parameter object available to expressions as params. Bindings select the parameter object with paramRef.",
							Ref:         ref(ValidationPolicyParamKind{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"match", "validations"},
			},
		},
		Dependencies: []string{
			ValidationPolicyNamedExpression{}.OpenAPIModelName(), ValidationPolicyParamKind{}.OpenAPIModelName(), ValidationPolicyResourceMatch{}.OpenAPIModelName(), ValidationPolicyValidation{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicyStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"compileErrors": {
						SchemaProps: spec.SchemaProps{
							Description: "Errors from the most recent attempt to compile the policy.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"string"},
										Format: "",
									},
								},
							},
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
										Ref: ref(ValidationPolicystatusOperatorState{}.OpenAPIModelName()),
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
			ValidationPolicystatusOperatorState{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicyValidation(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "Identifies the validation in results. Defaults to its index.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"expression": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"message": {
						SchemaProps: spec.SchemaProps{
							Description: "Returned when the validation fails.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"messageExpression": {
						SchemaProps: spec.SchemaProps{
							Description: "A CEL expression returning the message. Takes precedence over message.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"reason": {
						SchemaProps: spec.SchemaProps{
							Description: "Machine-readable reason returned when the validation fails. Defaults to Invalid.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"fieldPath": {
						SchemaProps: spec.SchemaProps{
							Description: "The field responsible for the failure, e.g. \"spec.labels\".",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"expression"},
			},
		},
	}
}

func schema_pkg_apis_policy_v0alpha1_ValidationPolicystatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
