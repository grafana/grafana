// SPDX-License-Identifier: AGPL-3.0-only

package provisioning

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/common"
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
