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
	"k8s.io/apiserver/pkg/admission"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

func TestDashboardAPIBuilder_GetGroupVersions(t *testing.T) {
	tests := []struct {
		name            string
		enabledFeatures []string
		expected        []schema.GroupVersion
	}{
		{
			name:            "should return v1 by default",
			enabledFeatures: []string{},
			expected: []schema.GroupVersion{
				dashv1.DashboardResourceInfo.GroupVersion(),
				dashv1beta1.DashboardResourceInfo.GroupVersion(),
				dashv0.DashboardResourceInfo.GroupVersion(),
				dashv2.DashboardResourceInfo.GroupVersion(),
				dashv2beta1.DashboardResourceInfo.GroupVersion(),
				dashv2alpha1.DashboardResourceInfo.GroupVersion(),
			},
		},
		{
			name:            "should return v1 as the default if some other feature is enabled",
			enabledFeatures: []string{},
			expected: []schema.GroupVersion{
				dashv1.DashboardResourceInfo.GroupVersion(),
				dashv1beta1.DashboardResourceInfo.GroupVersion(),
				dashv0.DashboardResourceInfo.GroupVersion(),
				dashv2.DashboardResourceInfo.GroupVersion(),
				dashv2beta1.DashboardResourceInfo.GroupVersion(),
				dashv2alpha1.DashboardResourceInfo.GroupVersion(),
			},
		},
		{
			name: "should return v2 as the default if dashboards v2 is enabled",
			enabledFeatures: []string{
				featuremgmt.FlagDashboardNewLayouts,
			},
			expected: []schema.GroupVersion{
				dashv2.DashboardResourceInfo.GroupVersion(),
				dashv2beta1.DashboardResourceInfo.GroupVersion(),
				dashv2alpha1.DashboardResourceInfo.GroupVersion(),
				dashv0.DashboardResourceInfo.GroupVersion(),
				dashv1.DashboardResourceInfo.GroupVersion(),
				dashv1beta1.DashboardResourceInfo.GroupVersion(),
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
