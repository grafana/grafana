package dashboard

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	types "k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/admission"
	k8scommon "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// newDashboardUnstructured builds a minimal unstructured dashboard with optional annotations.
func newDashboardUnstructured(name string, annotations map[string]string) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "dashboard.grafana.app/v1beta1",
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": "stacks-123",
			},
		},
	}
	if annotations != nil {
		obj.SetAnnotations(annotations)
	}
	return obj
}

func TestDashboardAPIBuilder_Validate(t *testing.T) {
	oneInt64 := int64(1)
	zeroInt64 := int64(0)

	tests := []struct {
		name               string
		inputObj           *dashv1.Dashboard
		deletionOptions    metav1.DeleteOptions
		managerAnnotations map[string]string
		getError           error
		checkRan           bool
		expectedError      bool
	}{
		{
			name: "should block deletion of provisioned dashboard (classic file provisioning)",
			inputObj: &dashv1.Dashboard{
				Spec:       common.Unstructured{},
				TypeMeta:   metav1.TypeMeta{Kind: "Dashboard"},
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
			},
			deletionOptions: metav1.DeleteOptions{GracePeriodSeconds: nil},
			managerAnnotations: map[string]string{
				utils.AnnoKeyManagerKind:     string(utils.ManagerKindClassicFP), //nolint:staticcheck
				utils.AnnoKeyManagerIdentity: "some-provisioner",
			},
			checkRan:      true,
			expectedError: true,
		},
		{
			name: "should return an error if Get fails",
			inputObj: &dashv1.Dashboard{
				Spec:       common.Unstructured{},
				TypeMeta:   metav1.TypeMeta{Kind: "Dashboard"},
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
			},
			deletionOptions: metav1.DeleteOptions{GracePeriodSeconds: nil},
			getError:        fmt.Errorf("generic error"),
			checkRan:        true,
			expectedError:   true,
		},
		{
			name: "should allow deletion if dashboard is not found",
			inputObj: &dashv1.Dashboard{
				Spec:       common.Unstructured{},
				TypeMeta:   metav1.TypeMeta{Kind: "Dashboard"},
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
			},
			deletionOptions: metav1.DeleteOptions{GracePeriodSeconds: nil},
			getError:        apierrors.NewNotFound(schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}, "test"),
			checkRan:        true,
			expectedError:   false,
		},
		{
			name: "should allow deletion of non-provisioned dashboard",
			inputObj: &dashv1.Dashboard{
				Spec:       common.Unstructured{},
				TypeMeta:   metav1.TypeMeta{Kind: "Dashboard"},
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
			},
			deletionOptions: metav1.DeleteOptions{GracePeriodSeconds: nil},
			checkRan:        true,
			expectedError:   false,
		},
		{
			name: "should allow deletion of dashboard managed by a non-classic-FP manager",
			inputObj: &dashv1.Dashboard{
				Spec:       common.Unstructured{},
				TypeMeta:   metav1.TypeMeta{Kind: "Dashboard"},
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
			},
			deletionOptions: metav1.DeleteOptions{GracePeriodSeconds: nil},
			managerAnnotations: map[string]string{
				utils.AnnoKeyManagerKind:     "some-other-manager",
				utils.AnnoKeyManagerIdentity: "some-identity",
			},
			checkRan:      true,
			expectedError: false,
		},
		{
			name: "should still run the check for delete if grace period is not 0",
			inputObj: &dashv1.Dashboard{
				Spec:       common.Unstructured{},
				TypeMeta:   metav1.TypeMeta{Kind: "Dashboard"},
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
			},
			deletionOptions: metav1.DeleteOptions{GracePeriodSeconds: &oneInt64},
			checkRan:        true,
			expectedError:   false,
		},
		{
			name: "should not run the check for delete if grace period is set to 0",
			inputObj: &dashv1.Dashboard{
				Spec:       common.Unstructured{},
				TypeMeta:   metav1.TypeMeta{Kind: "Dashboard"},
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
			},
			deletionOptions: metav1.DeleteOptions{GracePeriodSeconds: &zeroInt64},
			checkRan:        false,
			expectedError:   false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockHandler := &mockK8sHandler{}
			if tt.checkRan {
				if tt.getError != nil {
					mockHandler.getError = tt.getError
				} else {
					mockHandler.getResponse = newDashboardUnstructured("test", tt.managerAnnotations)
				}
			}

			b := &DashboardsAPIBuilder{
				dashboardK8sClient: mockHandler,
			}
			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				tt.inputObj,
				nil,
				dashv1.DashboardResourceInfo.GroupVersionKind(),
				"stacks-123",
				tt.inputObj.Name,
				dashv1.DashboardResourceInfo.GroupVersionResource(),
				"",
				admission.Operation("DELETE"),
				&tt.deletionOptions,
				true,
				&user.SignedInUser{},
			), nil)

			if tt.expectedError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			if tt.checkRan {
				require.True(t, mockHandler.getCalled, "Get should have been called")
			} else {
				require.False(t, mockHandler.getCalled, "Get should not have been called")
			}
		})
	}
}

// mockK8sHandler is a minimal mock for client.K8sHandler used in validateDelete tests.
type mockK8sHandler struct {
	getResponse *unstructured.Unstructured
	getError    error
	getCalled   bool
}

func (m *mockK8sHandler) Get(_ context.Context, _ string, _ int64, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	m.getCalled = true
	return m.getResponse, m.getError
}

// Unused methods — satisfy the client.K8sHandler interface.
func (m *mockK8sHandler) GetNamespace(_ int64) string { return "default" }
func (m *mockK8sHandler) Create(_ context.Context, _ *unstructured.Unstructured, _ int64, _ metav1.CreateOptions) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (m *mockK8sHandler) Update(_ context.Context, _ *unstructured.Unstructured, _ int64, _ metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (m *mockK8sHandler) Patch(_ context.Context, _ string, _ types.PatchType, _ []byte, _ int64, _ metav1.PatchOptions) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (m *mockK8sHandler) Delete(_ context.Context, _ string, _ int64, _ metav1.DeleteOptions) error {
	return nil
}
func (m *mockK8sHandler) DeleteCollection(_ context.Context, _ int64, _ metav1.ListOptions) error {
	return nil
}
func (m *mockK8sHandler) List(_ context.Context, _ int64, _ metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	return nil, nil
}
func (m *mockK8sHandler) Search(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	return nil, nil
}
func (m *mockK8sHandler) GetStats(_ context.Context, _ int64) (*resourcepb.ResourceStatsResponse, error) {
	return nil, nil
}
func (m *mockK8sHandler) GetUsersFromMeta(_ context.Context, _ []string) (map[string]*user.User, error) {
	return nil, nil
}

func TestSchemasEqualType(t *testing.T) {
	tests := []struct {
		name     string
		a, b     spec.Schema
		expected bool
	}{
		{
			name:     "both empty",
			a:        spec.Schema{},
			b:        spec.Schema{},
			expected: true,
		},
		{
			name:     "same type string",
			a:        spec.Schema{SchemaProps: spec.SchemaProps{Type: spec.StringOrArray{"string"}}},
			b:        spec.Schema{SchemaProps: spec.SchemaProps{Type: spec.StringOrArray{"string"}}},
			expected: true,
		},
		{
			name:     "different type",
			a:        spec.Schema{SchemaProps: spec.SchemaProps{Type: spec.StringOrArray{"string"}}},
			b:        spec.Schema{SchemaProps: spec.SchemaProps{Type: spec.StringOrArray{"integer"}}},
			expected: false,
		},
		{
			name: "same type same enum",
			a: spec.Schema{SchemaProps: spec.SchemaProps{
				Type: spec.StringOrArray{"string"},
				Enum: []interface{}{"Panel"},
			}},
			b: spec.Schema{SchemaProps: spec.SchemaProps{
				Type: spec.StringOrArray{"string"},
				Enum: []interface{}{"Panel"},
			}},
			expected: true,
		},
		{
			name: "same type different enum",
			a: spec.Schema{SchemaProps: spec.SchemaProps{
				Type: spec.StringOrArray{"string"},
				Enum: []interface{}{"Panel"},
			}},
			b: spec.Schema{SchemaProps: spec.SchemaProps{
				Type: spec.StringOrArray{"string"},
				Enum: []interface{}{"LibraryPanel"},
			}},
			expected: false,
		},
		{
			name: "same type one has enum",
			a: spec.Schema{SchemaProps: spec.SchemaProps{
				Type: spec.StringOrArray{"string"},
				Enum: []interface{}{"Panel"},
			}},
			b: spec.Schema{SchemaProps: spec.SchemaProps{
				Type: spec.StringOrArray{"string"},
			}},
			expected: false,
		},
		{
			name: "same ref",
			a: spec.Schema{SchemaProps: spec.SchemaProps{
				Ref: spec.MustCreateRef("#/definitions/Foo"),
			}},
			b: spec.Schema{SchemaProps: spec.SchemaProps{
				Ref: spec.MustCreateRef("#/definitions/Foo"),
			}},
			expected: true,
		},
		{
			name: "different ref",
			a: spec.Schema{SchemaProps: spec.SchemaProps{
				Ref: spec.MustCreateRef("#/definitions/Foo"),
			}},
			b: spec.Schema{SchemaProps: spec.SchemaProps{
				Ref: spec.MustCreateRef("#/definitions/Bar"),
			}},
			expected: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := schemasEqualType(&tt.a, &tt.b)
			require.Equal(t, tt.expected, got)
		})
	}
}

func TestFixOneOfSchema_DifferentEnumValues(t *testing.T) {
	// Simulate the DashboardElement union type where oneOf branches have
	// 'kind' with different enum values ("Panel" vs "LibraryPanel").
	defs := map[string]k8scommon.OpenAPIDefinition{
		"PanelKind": {
			Schema: spec.Schema{
				SchemaProps: spec.SchemaProps{
					Type: []string{"object"},
					Properties: map[string]spec.Schema{
						"kind": {
							SchemaProps: spec.SchemaProps{
								Type: []string{"string"},
								Enum:       []interface{}{"Panel"},
							},
						},
						"title": {
							SchemaProps: spec.SchemaProps{
								Type: []string{"string"},
							},
						},
					},
				},
			},
		},
		"LibraryPanelKind": {
			Schema: spec.Schema{
				SchemaProps: spec.SchemaProps{
					Type: []string{"object"},
					Properties: map[string]spec.Schema{
						"kind": {
							SchemaProps: spec.SchemaProps{
								Type: []string{"string"},
								Enum:       []interface{}{"LibraryPanel"},
							},
						},
						"name": {
							SchemaProps: spec.SchemaProps{
								Type: []string{"string"},
							},
						},
					},
				},
			},
		},
	}

	schema := &spec.Schema{
		SchemaProps: spec.SchemaProps{
			OneOf: []spec.Schema{
				{SchemaProps: spec.SchemaProps{Ref: spec.MustCreateRef("#/definitions/PanelKind")}},
				{SchemaProps: spec.SchemaProps{Ref: spec.MustCreateRef("#/definitions/LibraryPanelKind")}},
			},
		},
	}

	modified := fixOneOfSchema(schema, defs)
	require.True(t, modified)
	require.Equal(t, spec.StringOrArray{"object"}, schema.Type)

	// The 'kind' property should NOT have an enum constraint since the branches differ.
	// It should use x-kubernetes-preserve-unknown-fields instead.
	kindProp := schema.Properties["kind"]
	val, ok := kindProp.Extensions.GetBool("x-kubernetes-preserve-unknown-fields")
	require.True(t, ok, "x-kubernetes-preserve-unknown-fields should be set")
	require.True(t, val, "kind property should have x-kubernetes-preserve-unknown-fields when enum values differ")
	require.Empty(t, kindProp.Enum, "kind property should not have enum constraint when branches differ")

	// 'title' and 'name' should be preserved from their respective branches.
	_, hasTitle := schema.Properties["title"]
	require.True(t, hasTitle, "title property should be present from Panel branch")
	_, hasName := schema.Properties["name"]
	require.True(t, hasName, "name property should be present from LibraryPanel branch")
}

func TestFixUnionTypeSchemas_TopLevelBareOneOf(t *testing.T) {
	defs := map[string]k8scommon.OpenAPIDefinition{
		"SomeType": {
			Schema: spec.Schema{
				SchemaProps: spec.SchemaProps{
					Type: []string{"object"},
					Properties: map[string]spec.Schema{
						"kind": {
							SchemaProps: spec.SchemaProps{
								Type: []string{"string"},
								Enum:       []interface{}{"Panel"},
							},
						},
					},
				},
			},
		},
		"OtherType": {
			Schema: spec.Schema{
				SchemaProps: spec.SchemaProps{
					Type: []string{"object"},
					Properties: map[string]spec.Schema{
						"kind": {
							SchemaProps: spec.SchemaProps{
								Type: []string{"string"},
								Enum:       []interface{}{"LibraryPanel"},
							},
						},
					},
				},
			},
		},
		// A bare oneOf wrapper (no properties, no type) — the pattern that triggers the bug.
		"UnionWrapper": {
			Schema: spec.Schema{
				SchemaProps: spec.SchemaProps{
					OneOf: []spec.Schema{
						{SchemaProps: spec.SchemaProps{Ref: spec.MustCreateRef("#/definitions/SomeType")}},
						{SchemaProps: spec.SchemaProps{Ref: spec.MustCreateRef("#/definitions/OtherType")}},
					},
				},
			},
		},
	}

	fixUnionTypeSchemas(defs)

	wrapper := defs["UnionWrapper"]
	require.Equal(t, spec.StringOrArray{"object"}, wrapper.Schema.Type)
	require.NotEmpty(t, wrapper.Schema.Properties, "properties should be merged from branches")

	kindProp := wrapper.Schema.Properties["kind"]
	val, ok := kindProp.Extensions.GetBool("x-kubernetes-preserve-unknown-fields")
	require.True(t, ok, "x-kubernetes-preserve-unknown-fields should be set")
	require.True(t, val, "kind should use x-kubernetes-preserve-unknown-fields when enums differ across branches")
	require.Empty(t, kindProp.Enum, "enum should be removed from merged kind property")
}
