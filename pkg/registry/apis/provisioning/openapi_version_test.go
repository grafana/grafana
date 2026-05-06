// SPDX-License-Identifier: AGPL-3.0-only

package provisioning

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

func TestReplaceOpenAPIVersion(t *testing.T) {
	tests := []struct {
		name       string
		input      map[string]common.OpenAPIDefinition
		group      string
		oldVersion string
		newVersion string
		want       map[string]common.OpenAPIDefinition
	}{
		{
			name: "replaces version in keys",
			input: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
						},
					},
				},
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			want: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
						},
					},
				},
			},
		},
		{
			name: "removes old keys and adds new keys (no duplicates)",
			input: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
						},
					},
				},
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Connection": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
						},
					},
				},
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			want: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
						},
					},
				},
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Connection": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
						},
					},
				},
			},
		},
		{
			name: "updates schema refs",
			input: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							Properties: map[string]spec.Schema{
								"spec": {
									SchemaProps: spec.SchemaProps{
										Ref: spec.MustCreateRef("com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.RepositorySpec"),
									},
								},
							},
						},
					},
				},
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			want: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							Properties: map[string]spec.Schema{
								"spec": {
									SchemaProps: spec.SchemaProps{
										Ref: spec.MustCreateRef("com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositorySpec"),
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "updates dependencies",
			input: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
						},
					},
					Dependencies: []string{
						"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.RepositorySpec",
						"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.RepositoryStatus",
						"io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta",
					},
				},
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			want: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
						},
					},
					Dependencies: []string{
						"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositorySpec",
						"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryStatus",
						"io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta",
					},
				},
			},
		},
		{
			name: "updates nested properties",
			input: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							Properties: map[string]spec.Schema{
								"spec": {
									SchemaProps: spec.SchemaProps{
										Type: []string{"object"},
										Properties: map[string]spec.Schema{
											"config": {
												SchemaProps: spec.SchemaProps{
													Ref: spec.MustCreateRef("com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.RepositoryConfig"),
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			want: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							Properties: map[string]spec.Schema{
								"spec": {
									SchemaProps: spec.SchemaProps{
										Type: []string{"object"},
										Properties: map[string]spec.Schema{
											"config": {
												SchemaProps: spec.SchemaProps{
													Ref: spec.MustCreateRef("com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryConfig"),
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "updates array items",
			input: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.RepositoryList": {
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
													Ref: spec.MustCreateRef("com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Repository"),
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			want: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryList": {
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
													Ref: spec.MustCreateRef("com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Repository"),
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "handles allOf/anyOf/oneOf",
			input: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							AllOf: []spec.Schema{
								{
									SchemaProps: spec.SchemaProps{
										Ref: spec.MustCreateRef("com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.BaseRepository"),
									},
								},
							},
						},
					},
				},
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			want: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							AllOf: []spec.Schema{
								{
									SchemaProps: spec.SchemaProps{
										Ref: spec.MustCreateRef("com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.BaseRepository"),
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "updates x-kubernetes-group-version-kind extension",
			input: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Connection": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
						},
						VendorExtensible: spec.VendorExtensible{
							Extensions: spec.Extensions{
								"x-kubernetes-group-version-kind": []interface{}{
									map[string]interface{}{
										"group":   "provisioning.grafana.app",
										"kind":    "Connection",
										"version": "v0alpha1",
									},
								},
							},
						},
					},
				},
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			want: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Connection": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
						},
						VendorExtensible: spec.VendorExtensible{
							Extensions: spec.Extensions{
								"x-kubernetes-group-version-kind": []interface{}{
									map[string]interface{}{
										"group":   "provisioning.grafana.app",
										"kind":    "Connection",
										"version": "v1beta1",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "preserves non-matching refs",
			input: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							Properties: map[string]spec.Schema{
								"metadata": {
									SchemaProps: spec.SchemaProps{
										Ref: spec.MustCreateRef("io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta"),
									},
								},
								"spec": {
									SchemaProps: spec.SchemaProps{
										Ref: spec.MustCreateRef("com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.RepositorySpec"),
									},
								},
							},
						},
					},
					Dependencies: []string{
						"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.RepositorySpec",
						"io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta",
					},
				},
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			want: map[string]common.OpenAPIDefinition{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Repository": {
					Schema: spec.Schema{
						SchemaProps: spec.SchemaProps{
							Type: []string{"object"},
							Properties: map[string]spec.Schema{
								"metadata": {
									SchemaProps: spec.SchemaProps{
										Ref: spec.MustCreateRef("io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta"),
									},
								},
								"spec": {
									SchemaProps: spec.SchemaProps{
										Ref: spec.MustCreateRef("com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositorySpec"),
									},
								},
							},
						},
					},
					Dependencies: []string{
						"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositorySpec",
						"io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ReplaceOpenAPIVersion(tt.input, tt.group, tt.oldVersion, tt.newVersion)

			require.Equal(t, len(tt.want), len(got), "number of definitions should match")

			for key, wantDef := range tt.want {
				gotDef, ok := got[key]
				require.True(t, ok, "expected key %q not found in result", key)

				// Compare schema
				assert.Equal(t, wantDef.Schema, gotDef.Schema, "schema mismatch for key %q", key)

				// Compare dependencies
				assert.ElementsMatch(t, wantDef.Dependencies, gotDef.Dependencies, "dependencies mismatch for key %q", key)
			}

			// Verify old keys are not present
			oldVersionStr := "." + tt.group + "." + tt.oldVersion + "."
			newVersionStr := "." + tt.group + "." + tt.newVersion + "."
			for key := range tt.input {
				if key != strings.ReplaceAll(key, oldVersionStr, newVersionStr) {
					// This was an old key that should be replaced
					_, exists := got[key]
					assert.False(t, exists, "old key %q should not exist in result", key)
				}
			}
		})
	}
}

func TestReplaceInStringSlice(t *testing.T) {
	tests := []struct {
		name       string
		slice      []string
		oldVersion string
		newVersion string
		want       []string
	}{
		{
			name:       "empty slice",
			slice:      []string{},
			oldVersion: ".provisioning.v0alpha1.",
			newVersion: ".provisioning.v1beta1.",
			want:       []string{},
		},
		{
			name: "replaces version in all strings",
			slice: []string{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Repository",
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Connection",
			},
			oldVersion: ".provisioning.v0alpha1.",
			newVersion: ".provisioning.v1beta1.",
			want: []string{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Repository",
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Connection",
			},
		},
		{
			name: "preserves non-matching strings",
			slice: []string{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.Repository",
				"io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta",
			},
			oldVersion: ".provisioning.v0alpha1.",
			newVersion: ".provisioning.v1beta1.",
			want: []string{
				"com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Repository",
				"io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := replaceInStringSlice(tt.slice, tt.oldVersion, tt.newVersion)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestReplaceOpenAPISpecVersion(t *testing.T) {
	tests := []struct {
		name         string
		setupSpec    func() *spec3.OpenAPI
		group        string
		oldVersion   string
		newVersion   string
		validateSpec func(*testing.T, *spec3.OpenAPI)
	}{
		{
			name: "removes old version schemas and preserves new version",
			setupSpec: func() *spec3.OpenAPI {
				return &spec3.OpenAPI{
					Components: &spec3.Components{
						Schemas: map[string]*spec.Schema{
							// Both versions present (simulating OpenAPI aggregator behavior)
							"com.example.provisioning.v0alpha1.Resource": {
								SchemaProps: spec.SchemaProps{
									Type: []string{"object"},
								},
							},
							"com.example.provisioning.v1beta1.Resource": {
								SchemaProps: spec.SchemaProps{
									Type: []string{"object"},
								},
							},
							"io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta": {
								SchemaProps: spec.SchemaProps{
									Type: []string{"object"},
								},
							},
						},
					},
				}
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			validateSpec: func(t *testing.T, oas *spec3.OpenAPI) {
				require.NotNil(t, oas.Components)
				require.NotNil(t, oas.Components.Schemas)

				// Old version should be removed
				assert.Nil(t, oas.Components.Schemas["com.example.provisioning.v0alpha1.Resource"],
					"v0alpha1 schema should be deleted")

				// New version should still exist
				assert.NotNil(t, oas.Components.Schemas["com.example.provisioning.v1beta1.Resource"],
					"v1beta1 schema should be preserved")

				// Non-matching schemas should be preserved
				assert.NotNil(t, oas.Components.Schemas["io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta"],
					"k8s schemas should be preserved")
			},
		},
		{
			name: "updates $ref in component schemas",
			setupSpec: func() *spec3.OpenAPI {
				return &spec3.OpenAPI{
					Components: &spec3.Components{
						Schemas: map[string]*spec.Schema{
							// Old version (will be deleted)
							"com.example.provisioning.v0alpha1.Child": {
								SchemaProps: spec.SchemaProps{
									Type: []string{"object"},
								},
							},
							// New version with old refs (will be updated)
							"com.example.provisioning.v1beta1.Parent": {
								SchemaProps: spec.SchemaProps{
									Type: []string{"object"},
									Properties: map[string]spec.Schema{
										"child": {
											SchemaProps: spec.SchemaProps{
												Ref: spec.MustCreateRef("#/components/schemas/com.example.provisioning.v0alpha1.Child"),
											},
										},
									},
								},
							},
							"com.example.provisioning.v1beta1.Child": {
								SchemaProps: spec.SchemaProps{
									Type: []string{"object"},
								},
							},
						},
					},
				}
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			validateSpec: func(t *testing.T, oas *spec3.OpenAPI) {
				parent := oas.Components.Schemas["com.example.provisioning.v1beta1.Parent"]
				require.NotNil(t, parent, "Parent schema should exist")

				childProp := parent.Properties["child"]
				childRef := (&childProp.Ref).String()
				assert.Contains(t, childRef, ".provisioning.v1beta1.Child",
					"Child ref should be updated to v1beta1")
				assert.NotContains(t, childRef, "v0alpha1",
					"Child ref should not contain v0alpha1")
			},
		},
		{
			name: "updates $ref in path operations",
			setupSpec: func() *spec3.OpenAPI {
				return &spec3.OpenAPI{
					Components: &spec3.Components{
						Schemas: map[string]*spec.Schema{
							"com.example.provisioning.v0alpha1.Resource": {
								SchemaProps: spec.SchemaProps{
									Type: []string{"object"},
								},
							},
						},
					},
					Paths: &spec3.Paths{
						Paths: map[string]*spec3.Path{
							"/api/resources": {
								PathProps: spec3.PathProps{
									Get: &spec3.Operation{
										OperationProps: spec3.OperationProps{
											Responses: &spec3.Responses{
												ResponsesProps: spec3.ResponsesProps{
													StatusCodeResponses: map[int]*spec3.Response{
														200: {
															ResponseProps: spec3.ResponseProps{
																Content: map[string]*spec3.MediaType{
																	"application/json": {
																		MediaTypeProps: spec3.MediaTypeProps{
																			Schema: &spec.Schema{
																				SchemaProps: spec.SchemaProps{
																					Ref: spec.MustCreateRef("#/components/schemas/com.example.provisioning.v0alpha1.Resource"),
																				},
																			},
																		},
																	},
																},
															},
														},
													},
												},
											},
										},
									},
									Post: &spec3.Operation{
										OperationProps: spec3.OperationProps{
											RequestBody: &spec3.RequestBody{
												RequestBodyProps: spec3.RequestBodyProps{
													Content: map[string]*spec3.MediaType{
														"application/json": {
															MediaTypeProps: spec3.MediaTypeProps{
																Schema: &spec.Schema{
																	SchemaProps: spec.SchemaProps{
																		Ref: spec.MustCreateRef("#/components/schemas/com.example.provisioning.v0alpha1.Resource"),
																	},
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				}
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			validateSpec: func(t *testing.T, oas *spec3.OpenAPI) {
				path := oas.Paths.Paths["/api/resources"]
				require.NotNil(t, path)

				// Check GET response ref
				getSchema := path.Get.Responses.StatusCodeResponses[200].Content["application/json"].Schema
				getRef := (&getSchema.Ref).String()
				assert.Contains(t, getRef, ".provisioning.v1beta1.Resource",
					"GET response ref should be updated to v1beta1")
				assert.NotContains(t, getRef, "v0alpha1",
					"GET response ref should not contain v0alpha1")

				// Check POST request ref
				postSchema := path.Post.RequestBody.Content["application/json"].Schema
				postRef := (&postSchema.Ref).String()
				assert.Contains(t, postRef, ".provisioning.v1beta1.Resource",
					"POST request ref should be updated to v1beta1")
				assert.NotContains(t, postRef, "v0alpha1",
					"POST request ref should not contain v0alpha1")
			},
		},
		{
			name: "handles nil spec gracefully",
			setupSpec: func() *spec3.OpenAPI {
				return nil
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			validateSpec: func(t *testing.T, oas *spec3.OpenAPI) {
				// Should not panic
			},
		},
		{
			name: "handles empty components",
			setupSpec: func() *spec3.OpenAPI {
				return &spec3.OpenAPI{}
			},
			group:      "provisioning",
			oldVersion: "v0alpha1",
			newVersion: "v1beta1",
			validateSpec: func(t *testing.T, oas *spec3.OpenAPI) {
				// Should not panic
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			oas := tt.setupSpec()

			// Call the function
			ReplaceOpenAPISpecVersion(oas, tt.group, tt.oldVersion, tt.newVersion)

			// Validate results
			tt.validateSpec(t, oas)
		})
	}
}
