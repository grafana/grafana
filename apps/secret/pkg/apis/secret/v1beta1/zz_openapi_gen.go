package v1beta1

import (
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	common "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
	ptr "k8s.io/utils/ptr"
)

func GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return map[string]common.OpenAPIDefinition{
		secretv1beta1.Keeper{}.OpenAPIModelName():                         schema_pkg_apis_secret_v1beta1_Keeper(ref),
		secretv1beta1.KeeperAWSAssumeRole{}.OpenAPIModelName():            schema_pkg_apis_secret_v1beta1_KeeperAWSAssumeRole(ref),
		secretv1beta1.KeeperAWSConfig{}.OpenAPIModelName():                schema_pkg_apis_secret_v1beta1_KeeperAWSConfig(ref),
		secretv1beta1.KeeperList{}.OpenAPIModelName():                     schema_pkg_apis_secret_v1beta1_KeeperList(ref),
		secretv1beta1.KeeperSpec{}.OpenAPIModelName():                     schema_pkg_apis_secret_v1beta1_KeeperSpec(ref),
		secretv1beta1.KeeperStatus{}.OpenAPIModelName():                   schema_pkg_apis_secret_v1beta1_KeeperStatus(ref),
		secretv1beta1.KeeperstatusOperatorState{}.OpenAPIModelName():      schema_pkg_apis_secret_v1beta1_KeeperstatusOperatorState(ref),
		secretv1beta1.SecureValue{}.OpenAPIModelName():                    schema_pkg_apis_secret_v1beta1_SecureValue(ref),
		secretv1beta1.SecureValueList{}.OpenAPIModelName():                schema_pkg_apis_secret_v1beta1_SecureValueList(ref),
		secretv1beta1.SecureValueSpec{}.OpenAPIModelName():                schema_pkg_apis_secret_v1beta1_SecureValueSpec(ref),
		secretv1beta1.SecureValueStatus{}.OpenAPIModelName():              schema_pkg_apis_secret_v1beta1_SecureValueStatus(ref),
		secretv1beta1.SecureValuestatusOperatorState{}.OpenAPIModelName(): schema_pkg_apis_secret_v1beta1_SecureValuestatusOperatorState(ref),
	}
}

func schema_pkg_apis_secret_v1beta1_Keeper(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Description: "Spec is the spec of the Keeper",
							Default:     map[string]interface{}{},
							Ref:         ref(secretv1beta1.KeeperSpec{}.OpenAPIModelName()),
						},
					},
					"status": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(secretv1beta1.KeeperStatus{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec", "status"},
			},
		},
		Dependencies: []string{
			secretv1beta1.KeeperSpec{}.OpenAPIModelName(), secretv1beta1.KeeperStatus{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_secret_v1beta1_KeeperAWSAssumeRole(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"assumeRoleArn": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"externalID": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"assumeRoleArn", "externalID"},
			},
		},
	}
}

func schema_pkg_apis_secret_v1beta1_KeeperAWSConfig(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"region": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"assumeRole": {
						SchemaProps: spec.SchemaProps{
							Ref: ref(secretv1beta1.KeeperAWSAssumeRole{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"region"},
			},
		},
		Dependencies: []string{
			secretv1beta1.KeeperAWSAssumeRole{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_secret_v1beta1_KeeperList(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
										Ref:     ref(secretv1beta1.Keeper{}.OpenAPIModelName()),
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
			secretv1beta1.Keeper{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_secret_v1beta1_KeeperSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"description": {
						SchemaProps: spec.SchemaProps{
							Description: "Short description for the Keeper.",
							Default:     "",
							MinLength:   ptr.To[int64](1),
							MaxLength:   ptr.To[int64](253),
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"aws": {
						VendorExtensible: spec.VendorExtensible{
							Extensions: spec.Extensions{
								"x-kubernetes-map-type": "atomic",
							},
						},
						SchemaProps: spec.SchemaProps{
							Description: "AWS Keeper Configuration.",
							Ref:         ref(secretv1beta1.KeeperAWSConfig{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"description"},
			},
		},
		Dependencies: []string{
			secretv1beta1.KeeperAWSConfig{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_secret_v1beta1_KeeperStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
										Ref:     ref(secretv1beta1.KeeperstatusOperatorState{}.OpenAPIModelName()),
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
			secretv1beta1.KeeperstatusOperatorState{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_secret_v1beta1_KeeperstatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
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

func schema_pkg_apis_secret_v1beta1_SecureValue(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
							Description: "Spec is the spec of the SecureValue",
							Default:     map[string]interface{}{},
							Ref:         ref(secretv1beta1.SecureValueSpec{}.OpenAPIModelName()),
						},
					},
					"status": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(secretv1beta1.SecureValueStatus{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec", "status"},
			},
		},
		Dependencies: []string{
			secretv1beta1.SecureValueSpec{}.OpenAPIModelName(), secretv1beta1.SecureValueStatus{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_secret_v1beta1_SecureValueList(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
										Ref:     ref(secretv1beta1.SecureValue{}.OpenAPIModelName()),
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
			secretv1beta1.SecureValue{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_secret_v1beta1_SecureValueSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"description": {
						SchemaProps: spec.SchemaProps{
							Description: "Short description that explains the purpose of this SecureValue.",
							Default:     "",
							MinLength:   ptr.To[int64](1),
							MaxLength:   ptr.To[int64](25),
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"value": {
						SchemaProps: spec.SchemaProps{
							Description: "The raw value is only valid for write. Read/List will always be empty. There is no support for mixing `value` and `ref`, you can't create a secret in a third-party keeper with a specified `ref`. Minimum and maximum lengths in bytes.",
							MinLength:   ptr.To[int64](1),
							MaxLength:   ptr.To[int64](24576),
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"ref": {
						SchemaProps: spec.SchemaProps{
							Description: "When using a third-party keeper, the `ref` is used to reference a value inside the remote storage. This should not contain sensitive information.",
							MinLength:   ptr.To[int64](1),
							MaxLength:   ptr.To[int64](1024),
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"decrypters": {
						VendorExtensible: spec.VendorExtensible{
							Extensions: spec.Extensions{
								"x-kubernetes-list-type": "atomic",
							},
						},
						SchemaProps: spec.SchemaProps{
							Description: "The Decrypters that are allowed to decrypt this secret. An empty list means no service can decrypt it.",
							MaxItems:    ptr.To[int64](64),
							UniqueItems: true,
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
				},
				Required: []string{"description"},
			},
		},
	}
}

func schema_pkg_apis_secret_v1beta1_SecureValueStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"version": {
						SchemaProps: spec.SchemaProps{
							Description: "Version of the secure value. Cannot be set.",
							Default:     0,
							Type:        []string{"integer"},
							Format:      "int64",
						},
					},
					"externalID": {
						SchemaProps: spec.SchemaProps{
							Description: "External ID where the secret is stored. Cannot be set.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
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
										Ref:     ref(secretv1beta1.SecureValuestatusOperatorState{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"keeper": {
						SchemaProps: spec.SchemaProps{
							Description: "The name of the keeper used to create the secure value. Cannot be set.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
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
				Required: []string{"keeper"},
			},
		},
		Dependencies: []string{
			secretv1beta1.SecureValuestatusOperatorState{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_secret_v1beta1_SecureValuestatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
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
