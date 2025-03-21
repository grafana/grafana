package dashboard

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
)

func TestDashboardAPIBuilder_Validate(t *testing.T) {
	oneInt64 := int64(1)
	zeroInt64 := int64(0)
	createDashboard := func(schemaVersion interface{}, gvk schema.GroupVersionKind) runtime.Object {
		var obj runtime.Object
		switch gvk.Version {
		case "v0alpha1":
			obj = &v0alpha1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			}
			if schemaVersion != nil {
				obj.(*v0alpha1.Dashboard).Spec.Object["schemaVersion"] = schemaVersion
			}
		default:
			obj = &v1alpha1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			}
			if schemaVersion != nil {
				obj.(*v1alpha1.Dashboard).Spec.Object["schemaVersion"] = schemaVersion
			}
		}
		return obj
	}

	tests := []struct {
		name                   string
		inputObj               runtime.Object
		gvk                    schema.GroupVersionKind
		operation              admission.Operation
		operationOptions       interface{}
		dashboardResponse      *dashboards.DashboardProvisioning
		dashboardErrorResponse error
		checkRan               bool
		expectedError          bool
	}{
		{
			name: "should return an error if data is found",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			gvk:       v1alpha1.DashboardResourceInfo.GroupVersionKind(),
			operation: admission.Delete,
			operationOptions: &metav1.DeleteOptions{
				GracePeriodSeconds: nil,
			},
			dashboardResponse:      &dashboards.DashboardProvisioning{ID: 1},
			dashboardErrorResponse: nil,
			checkRan:               true,
			expectedError:          true,
		},
		{
			name: "should return an error if unable to check",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			gvk:       v1alpha1.DashboardResourceInfo.GroupVersionKind(),
			operation: admission.Delete,
			operationOptions: &metav1.DeleteOptions{
				GracePeriodSeconds: nil,
			},
			dashboardResponse:      nil,
			dashboardErrorResponse: fmt.Errorf("generic error"),
			checkRan:               true,
			expectedError:          true,
		},
		{
			name: "should be okay if error is provisioned dashboard not found",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			gvk:       v1alpha1.DashboardResourceInfo.GroupVersionKind(),
			operation: admission.Delete,
			operationOptions: &metav1.DeleteOptions{
				GracePeriodSeconds: nil,
			},
			dashboardResponse:      nil,
			dashboardErrorResponse: dashboards.ErrProvisionedDashboardNotFound,
			checkRan:               true,
			expectedError:          false,
		},
		{
			name: "Should still run the check for delete if grace period is not 0",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			gvk:       v1alpha1.DashboardResourceInfo.GroupVersionKind(),
			operation: admission.Delete,
			operationOptions: &metav1.DeleteOptions{
				GracePeriodSeconds: &oneInt64,
			},
			dashboardResponse:      nil,
			dashboardErrorResponse: nil,
			checkRan:               true,
			expectedError:          false,
		},
		{
			name: "should not run the check for delete if grace period is set to 0",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			gvk: v1alpha1.DashboardResourceInfo.GroupVersionKind(),
			operationOptions: &metav1.DeleteOptions{
				GracePeriodSeconds: &zeroInt64,
			},
			dashboardResponse:      nil,
			dashboardErrorResponse: nil,
			checkRan:               false,
			expectedError:          false,
		},
		{
			name:             "v0 should skip schema version validation",
			inputObj:         createDashboard(schemaversion.MIN_VERSION-1, v0alpha1.DashboardResourceInfo.GroupVersionKind()),
			gvk:              v0alpha1.DashboardResourceInfo.GroupVersionKind(),
			operation:        admission.Create,
			operationOptions: &metav1.CreateOptions{},
			expectedError:    false,
			checkRan:         false,
		},
		{
			name: "create with warn validation should allow old schema version",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"schemaVersion": schemaversion.MIN_VERSION - 1,
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			gvk:       v1alpha1.DashboardResourceInfo.GroupVersionKind(),
			operation: admission.Create,
			operationOptions: &metav1.CreateOptions{
				FieldValidation: metav1.FieldValidationWarn,
			},
			expectedError: false,
			checkRan:      false,
		},
		{
			name: "create with ignore validation should allow old schema version",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"schemaVersion": schemaversion.MIN_VERSION - 1,
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			gvk:       v1alpha1.DashboardResourceInfo.GroupVersionKind(),
			operation: admission.Create,
			operationOptions: &metav1.CreateOptions{
				FieldValidation: metav1.FieldValidationIgnore,
			},
			expectedError: false,
			checkRan:      false,
		},
		{
			name: "create with valid schema version should pass",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"schemaVersion": schemaversion.LATEST_VERSION,
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			gvk:              v1alpha1.DashboardResourceInfo.GroupVersionKind(),
			operation:        admission.Create,
			operationOptions: &metav1.CreateOptions{},
			expectedError:    false,
			checkRan:         false,
		},
		{
			name: "update with strict validation should error on old schema version",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"schemaVersion": schemaversion.MIN_VERSION - 1,
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			gvk:              v1alpha1.DashboardResourceInfo.GroupVersionKind(),
			operation:        admission.Update,
			operationOptions: &metav1.UpdateOptions{},
			expectedError:    true,
			checkRan:         false,
		},
		{
			name: "update with valid schema version should pass",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"schemaVersion": schemaversion.LATEST_VERSION,
					},
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Dashboard",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
			},
			gvk:              v1alpha1.DashboardResourceInfo.GroupVersionKind(),
			operation:        admission.Update,
			operationOptions: &metav1.UpdateOptions{},
			expectedError:    false,
			checkRan:         false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeService := &dashboards.FakeDashboardProvisioning{}
			fakeService.On("GetProvisionedDashboardDataByDashboardUID", mock.Anything, mock.Anything, mock.Anything).Return(tt.dashboardResponse, tt.dashboardErrorResponse).Once()
			b := &DashboardsAPIBuilder{
				log:                          log.NewNopLogger(),
				dashboardProvisioningService: fakeService,
			}
			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				tt.inputObj,
				nil,
				tt.gvk,
				"stacks-123",
				tt.inputObj.(metav1.Object).GetName(),
				schema.GroupVersionResource{
					Group:    tt.gvk.Group,
					Version:  tt.gvk.Version,
					Resource: "dashboards",
				},
				"",
				tt.operation,
				tt.operationOptions.(runtime.Object),
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
			name:            "should return v0alpha1 by default",
			enabledFeatures: []string{},
			expected: []schema.GroupVersion{
				v0alpha1.DashboardResourceInfo.GroupVersion(),
				v1alpha1.DashboardResourceInfo.GroupVersion(),
				v2alpha1.DashboardResourceInfo.GroupVersion(),
			},
		},
		{
			name: "should return v0alpha1 as the default if some other feature is enabled",
			enabledFeatures: []string{
				featuremgmt.FlagKubernetesDashboards,
			},
			expected: []schema.GroupVersion{
				v0alpha1.DashboardResourceInfo.GroupVersion(),
				v1alpha1.DashboardResourceInfo.GroupVersion(),
				v2alpha1.DashboardResourceInfo.GroupVersion(),
			},
		},
		{
			name: "should return v2alpha1 as the default if dashboards v2 is enabled",
			enabledFeatures: []string{
				featuremgmt.FlagDashboardNewLayouts,
			},
			expected: []schema.GroupVersion{
				v2alpha1.DashboardResourceInfo.GroupVersion(),
				v0alpha1.DashboardResourceInfo.GroupVersion(),
				v1alpha1.DashboardResourceInfo.GroupVersion(),
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
