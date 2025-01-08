package dashboard

import (
	"context"
	"fmt"
	"testing"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"
)

func TestDashboardAPIBuilder_Validate(t *testing.T) {
	oneInt64 := int64(1)
	zeroInt64 := int64(0)
	tests := []struct {
		name                   string
		inputObj               *v0alpha1.Dashboard
		deletionOptions        metav1.DeleteOptions
		dashboardResponse      *dashboards.DashboardProvisioning
		dashboardErrorResponse error
		checkRan               bool
		expectedError          bool
	}{
		{
			name: "should return an error if data is found",
			inputObj: &v0alpha1.Dashboard{
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
			inputObj: &v0alpha1.Dashboard{
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
			inputObj: &v0alpha1.Dashboard{
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
			inputObj: &v0alpha1.Dashboard{
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
			inputObj: &v0alpha1.Dashboard{
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
				ProvisioningDashboardService: fakeService,
			}
			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				tt.inputObj,
				nil,
				v0alpha1.DashboardResourceInfo.GroupVersionKind(),
				"stacks-123",
				tt.inputObj.Name,
				v0alpha1.DashboardResourceInfo.GroupVersionResource(),
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
