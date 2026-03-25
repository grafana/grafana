package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// newDashboardJSON builds a minimal K8s-style JSON for a dashboard with optional manager annotations.
func newDashboardJSON(t *testing.T, name string, annotations map[string]string) []byte {
	t.Helper()
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
	data, err := json.Marshal(obj)
	require.NoError(t, err)
	return data
}

func TestDashboardAPIBuilder_Validate(t *testing.T) {
	oneInt64 := int64(1)
	zeroInt64 := int64(0)

	tests := []struct {
		name            string
		inputObj        *dashv1.Dashboard
		deletionOptions metav1.DeleteOptions
		readResponse    *resourcepb.ReadResponse
		readError       error
		checkRan        bool
		expectedError   bool
	}{
		{
			name: "should block deletion of provisioned dashboard (classic file provisioning)",
			inputObj: &dashv1.Dashboard{
				Spec: common.Unstructured{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			deletionOptions: metav1.DeleteOptions{
				GracePeriodSeconds: nil,
			},
			readResponse: &resourcepb.ReadResponse{
				Value: nil, // set per-test in t.Run
			},
			checkRan:      true,
			expectedError: true,
		},
		{
			name: "should return an error if Read fails",
			inputObj: &dashv1.Dashboard{
				Spec: common.Unstructured{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			deletionOptions: metav1.DeleteOptions{
				GracePeriodSeconds: nil,
			},
			readResponse:  nil,
			readError:     fmt.Errorf("generic error"),
			checkRan:      true,
			expectedError: true,
		},
		{
			name: "should allow deletion if dashboard is not found",
			inputObj: &dashv1.Dashboard{
				Spec: common.Unstructured{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			deletionOptions: metav1.DeleteOptions{
				GracePeriodSeconds: nil,
			},
			readResponse: &resourcepb.ReadResponse{
				Error: &resourcepb.ErrorResult{Code: 404, Message: "not found"},
			},
			checkRan:      true,
			expectedError: false,
		},
		{
			name: "should fail closed on non-404 storage error",
			inputObj: &dashv1.Dashboard{
				Spec: common.Unstructured{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			deletionOptions: metav1.DeleteOptions{
				GracePeriodSeconds: nil,
			},
			readResponse: &resourcepb.ReadResponse{
				Error: &resourcepb.ErrorResult{Code: 500, Message: "internal server error"},
			},
			checkRan:      true,
			expectedError: true,
		},
		{
			name: "should allow deletion of non-provisioned dashboard",
			inputObj: &dashv1.Dashboard{
				Spec: common.Unstructured{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			deletionOptions: metav1.DeleteOptions{
				GracePeriodSeconds: nil,
			},
			readResponse: &resourcepb.ReadResponse{
				Value: nil, // set per-test in t.Run
			},
			checkRan:      true,
			expectedError: false,
		},
		{
			name: "should still run the check for delete if grace period is not 0",
			inputObj: &dashv1.Dashboard{
				Spec: common.Unstructured{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			deletionOptions: metav1.DeleteOptions{
				GracePeriodSeconds: &oneInt64,
			},
			readResponse: &resourcepb.ReadResponse{
				Value: nil, // set per-test in t.Run
			},
			checkRan:      true,
			expectedError: false,
		},
		{
			name: "should not run the check for delete if grace period is set to 0",
			inputObj: &dashv1.Dashboard{
				Spec: common.Unstructured{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			deletionOptions: metav1.DeleteOptions{
				GracePeriodSeconds: &zeroInt64,
			},
			readResponse:  nil,
			readError:     nil,
			checkRan:      false,
			expectedError: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := resource.NewMockResourceClient(t)

			if tt.checkRan {
				// Set the Value field for tests that need dashboard JSON
				resp := tt.readResponse
				if resp != nil && resp.Error == nil {
					switch tt.name {
					case "should block deletion of provisioned dashboard (classic file provisioning)":
						resp.Value = newDashboardJSON(t, "test", map[string]string{
							utils.AnnoKeyManagerKind:     string(utils.ManagerKindClassicFP), //nolint:staticcheck
							utils.AnnoKeyManagerIdentity: "some-provisioner",
						})
					default:
						// Non-provisioned dashboard (no manager annotations)
						resp.Value = newDashboardJSON(t, "test", nil)
					}
				}
				mockClient.On("Read", mock.Anything, mock.Anything).Return(resp, tt.readError)
			}

			b := &DashboardsAPIBuilder{
				unified: mockClient,
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
				mockClient.AssertCalled(t, "Read", mock.Anything, mock.Anything)
			} else {
				mockClient.AssertNotCalled(t, "Read", mock.Anything, mock.Anything)
			}
		})
	}
}

func TestDashboardAPIBuilder_GetGroupVersions(t *testing.T) {
	tests := []struct {
		name            string
		enabledFeatures []string
		expected        []schema.GroupVersion
	}{
		{
			name:            "should return v1alpha1 by default",
			enabledFeatures: []string{},
			expected: []schema.GroupVersion{
				dashv1.DashboardResourceInfo.GroupVersion(),
				dashv0.DashboardResourceInfo.GroupVersion(),
				dashv2beta1.DashboardResourceInfo.GroupVersion(),
				dashv2alpha1.DashboardResourceInfo.GroupVersion(),
			},
		},
		{
			name: "should return v1alpha1 as the default if some other feature is enabled",
			enabledFeatures: []string{
				featuremgmt.FlagKubernetesDashboards,
			},
			expected: []schema.GroupVersion{
				dashv1.DashboardResourceInfo.GroupVersion(),
				dashv0.DashboardResourceInfo.GroupVersion(),
				dashv2beta1.DashboardResourceInfo.GroupVersion(),
				dashv2alpha1.DashboardResourceInfo.GroupVersion(),
			},
		},
		{
			name: "should return v2alpha1 as the default if dashboards v2 is enabled",
			enabledFeatures: []string{
				featuremgmt.FlagDashboardNewLayouts,
			},
			expected: []schema.GroupVersion{
				dashv2beta1.DashboardResourceInfo.GroupVersion(),
				dashv2alpha1.DashboardResourceInfo.GroupVersion(),
				dashv0.DashboardResourceInfo.GroupVersion(),
				dashv1.DashboardResourceInfo.GroupVersion(),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := &DashboardsAPIBuilder{
				features: newMockFeatureToggles(t, tt.enabledFeatures...),
			}

			require.Equal(t, tt.expected, builder.GetGroupVersions())
		})
	}
}

type mockFeatureToggles struct {
	// We need to make a copy in `GetEnabled` anyway,
	// so no need to store the original map as map[string]bool.
	enabledFeatures map[string]struct{}
}

func newMockFeatureToggles(t *testing.T, enabledFeatures ...string) featuremgmt.FeatureToggles {
	t.Helper()

	res := &mockFeatureToggles{
		enabledFeatures: make(map[string]struct{}, len(enabledFeatures)),
	}

	for _, f := range enabledFeatures {
		res.enabledFeatures[f] = struct{}{}
	}

	return res
}

func (m *mockFeatureToggles) IsEnabledGlobally(feature string) bool {
	_, ok := m.enabledFeatures[feature]
	return ok
}

func (m *mockFeatureToggles) IsEnabled(ctx context.Context, feature string) bool {
	_, ok := m.enabledFeatures[feature]
	return ok
}

func (m *mockFeatureToggles) GetEnabled(ctx context.Context) map[string]bool {
	res := make(map[string]bool, len(m.enabledFeatures))

	for f := range m.enabledFeatures {
		res[f] = true
	}

	return res
}
