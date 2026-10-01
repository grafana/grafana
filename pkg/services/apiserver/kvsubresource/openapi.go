package kvsubresource

import (
	"k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

// GetOpenAPIDefinitions returns the OpenAPI schema for types in this package.
// It must be merged into the server's combined GetOpenAPIDefinitions function
// (both the builder path and the appinstaller path) so that kube-openapi can
// resolve KVResponse when it walks routes that produce this type.
func GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return map[string]common.OpenAPIDefinition{
		KVResponse{}.OpenAPIModelName(): schemaKVResponse(ref),
	}
}

func schemaKVResponse(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "KVResponse is the OpenAPI response envelope for the KV subresource. " +
					"Actual HTTP responses are written directly; this type exists solely to give " +
					"kube-openapi a resolvable model for the /kv and /kv:batch sub-paths.",
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta"),
						},
					},
					"keys": {
						VendorExtensible: spec.VendorExtensible{
							Extensions: spec.Extensions{
								"x-kubernetes-list-type": "atomic",
							},
						},
						SchemaProps: spec.SchemaProps{
							Description: "Keys is populated by list operations; omitted from get/write responses.",
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
			},
		},
		Dependencies: []string{
			"io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta",
		},
	}
}
