package dashboard

import (
	"context"
	"fmt"
	"testing"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
)

func TestDashboardAPIBuilder_Validate(t *testing.T) {
	oneInt64 := int64(1)
	zeroInt64 := int64(0)
	tests := []struct {
		name                   string
		inputObj               *dashv1.Dashboard
		deletionOptions        metav1.DeleteOptions
		dashboardResponse      *dashboards.DashboardProvisioning
		dashboardErrorResponse error
		checkRan               bool
		expectedError          bool
	}{
		{
			name: "should return an error if data is found",
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
			dashboardResponse:      &dashboards.DashboardProvisioning{ID: 1},
			dashboardErrorResponse: nil,
			checkRan:               true,
			expectedError:          true,
		},
		{
			name: "should return an error if unable to check",
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
			dashboardResponse:      nil,
			dashboardErrorResponse: fmt.Errorf("generic error"),
			checkRan:               true,
			expectedError:          true,
		},
		{
			name: "should be okay if error is provisioned dashboard not found",
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
			dashboardResponse:      nil,
			dashboardErrorResponse: dashboards.ErrProvisionedDashboardNotFound,
			checkRan:               true,
			expectedError:          false,
		},
		{
			name: "Should still run the check for delete if grace period is not 0",
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
			dashboardResponse:      nil,
			dashboardErrorResponse: nil,
			checkRan:               true,
			expectedError:          false,
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
			dashboardResponse:      nil,
			dashboardErrorResponse: nil,
			checkRan:               false,
			expectedError:          false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeService := &dashboards.FakeDashboardProvisioning{}
			fakeService.On("GetProvisionedDashboardDataByDashboardUID", mock.Anything, mock.Anything, mock.Anything).Return(tt.dashboardResponse, tt.dashboardErrorResponse).Once()
			b := &DashboardsAPIBuilder{
				dashboardProvisioningService: fakeService,
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
				fakeService.AssertCalled(t, "GetProvisionedDashboardDataByDashboardUID", mock.Anything, mock.Anything, mock.Anything)
			} else {
				fakeService.AssertNotCalled(t, "GetProvisionedDashboardDataByDashboardUID", mock.Anything, mock.Anything, mock.Anything)
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
				dashv2.DashboardResourceInfo.GroupVersion(),
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
				dashv2.DashboardResourceInfo.GroupVersion(),
			},
		},
		{
			name: "should return v2alpha1 as the default if dashboards v2 is enabled",
			enabledFeatures: []string{
				featuremgmt.FlagDashboardNewLayouts,
			},
			expected: []schema.GroupVersion{
				dashv2.DashboardResourceInfo.GroupVersion(),
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
