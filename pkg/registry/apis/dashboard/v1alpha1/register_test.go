package v1alpha1

import (
	"context"
	"testing"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"
)

func TestDashboardAPIBuilder_Mutate(t *testing.T) {
	tests := []struct {
		name     string
		verb     string
		input    *v1alpha1.Dashboard
		expected *v1alpha1.Dashboard
	}{
		{
			name: "should remove id and add as label in create",
			verb: "CREATE",
			input: &v1alpha1.Dashboard{
				Spec: v1alpha1.DashboardSpec{
					Title: "test",
					Unstructured: common.Unstructured{
						Object: map[string]interface{}{
							"id": float64(1),
						},
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			expected: &v1alpha1.Dashboard{
				Spec: v1alpha1.DashboardSpec{
					Title: "test",
					Unstructured: common.Unstructured{
						Object: map[string]interface{}{},
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:   "test",
					Labels: map[string]string{"grafana.app/deprecatedInternalID": "1"},
				},
			},
		},
		{
			name: "should remove id and add as label in update",
			verb: "UPDATE",
			input: &v1alpha1.Dashboard{
				Spec: v1alpha1.DashboardSpec{
					Title: "test",
					Unstructured: common.Unstructured{
						Object: map[string]interface{}{
							"id": float64(1),
						},
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			expected: &v1alpha1.Dashboard{
				Spec: v1alpha1.DashboardSpec{
					Title: "test",
					Unstructured: common.Unstructured{
						Object: map[string]interface{}{},
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:   "test",
					Labels: map[string]string{"grafana.app/deprecatedInternalID": "1"},
				},
			},
		},
		{
			name: "should only remove id ",
			verb: "UPDATE",
			input: &v1alpha1.Dashboard{
				Spec: v1alpha1.DashboardSpec{
					Title: "test",
					Unstructured: common.Unstructured{
						Object: map[string]interface{}{
							"id":      float64(1),
							"testing": "this",
						},
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			expected: &v1alpha1.Dashboard{
				Spec: v1alpha1.DashboardSpec{
					Title: "test",
					Unstructured: common.Unstructured{
						Object: map[string]interface{}{
							"testing": "this",
						},
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:   "test",
					Labels: map[string]string{"grafana.app/deprecatedInternalID": "1"},
				},
			},
		},
		{
			name: "should not set label if id is 0",
			verb: "CREATE",
			input: &v1alpha1.Dashboard{
				Spec: v1alpha1.DashboardSpec{
					Title: "test",
					Unstructured: common.Unstructured{
						Object: map[string]interface{}{
							"id": float64(0),
						},
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			expected: &v1alpha1.Dashboard{
				Spec: v1alpha1.DashboardSpec{
					Title: "test",
					Unstructured: common.Unstructured{
						Object: map[string]interface{}{},
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
		},
	}
	b := &DashboardsAPIBuilder{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := b.Mutate(context.Background(), admission.NewAttributesRecord(
				tt.input,
				nil,
				v1alpha1.DashboardResourceInfo.GroupVersionKind(),
				"stacks-123",
				tt.input.Name,
				v1alpha1.DashboardResourceInfo.GroupVersionResource(),
				"",
				admission.Operation(tt.verb),
				nil,
				true,
				&user.SignedInUser{},
			), nil)

			require.NoError(t, err)
			require.Equal(t, tt.expected, tt.input)
		})
	}
}
