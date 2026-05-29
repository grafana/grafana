package dashboard

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
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

func TestDashboardAPIBuilder_ValidateCreate_DeprecatedInternalIDUniqueness(t *testing.T) {
	const newUID = "new-uid"

	tests := []struct {
		name              string
		labelValue        string // value for grafana.app/deprecatedInternalID; "" means no label
		isStandalone      bool
		dryRun            bool
		getUIDRef         *dashboards.DashboardRef
		getUIDErr         error
		expectGetUIDCall  bool
		expectConflict    bool
		expectGenericFail bool
	}{
		{
			name:             "unused internalID succeeds",
			labelValue:       "1247",
			getUIDErr:        dashboards.ErrDashboardNotFound,
			expectGetUIDCall: true,
		},
		{
			name:             "internalID owned by other dashboard is rejected as conflict",
			labelValue:       "1247",
			getUIDRef:        &dashboards.DashboardRef{UID: "other-uid"},
			expectGetUIDCall: true,
			expectConflict:   true,
		},
		{
			name:             "internalID already duplicated in store is rejected as conflict",
			labelValue:       "1247",
			getUIDErr:        &dashboards.DeprecatedInternalIDConflictError{ID: 1247, Count: 2},
			expectGetUIDCall: true,
			expectConflict:   true,
		},
		{
			name:             "same uid is treated as idempotent and allowed",
			labelValue:       "1247",
			getUIDRef:        &dashboards.DashboardRef{UID: newUID},
			expectGetUIDCall: true,
		},
		{
			name:             "missing internalID label skips the check",
			labelValue:       "",
			expectGetUIDCall: false,
		},
		{
			name:             "dry-run skips the check",
			labelValue:       "1247",
			dryRun:           true,
			expectGetUIDCall: false,
		},
		{
			name:             "standalone skips the check",
			labelValue:       "1247",
			isStandalone:     true,
			expectGetUIDCall: false,
		},
		{
			name:              "generic service error is surfaced",
			labelValue:        "1247",
			getUIDErr:         fmt.Errorf("kaboom"),
			expectGetUIDCall:  true,
			expectGenericFail: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			labels := map[string]string{}
			if tt.labelValue != "" {
				labels["grafana.app/deprecatedInternalID"] = tt.labelValue
			}
			inputObj := &dashv1.Dashboard{
				Spec:     common.Unstructured{Object: map[string]interface{}{"title": "T"}},
				TypeMeta: metav1.TypeMeta{Kind: "Dashboard"},
				ObjectMeta: metav1.ObjectMeta{
					Name:      newUID,
					Namespace: "stacks-123",
					Labels:    labels,
				},
			}

			svc := dashboards.NewFakeDashboardService(t)
			svc.On("ValidateBasicDashboardProperties", mock.Anything, mock.Anything, mock.Anything).Return(nil)
			svc.On("ValidateDashboardRefreshInterval", mock.Anything, mock.Anything).Return(nil)
			if tt.expectGetUIDCall {
				svc.On("GetDashboardUIDByID", mock.Anything, mock.Anything).
					Return(tt.getUIDRef, tt.getUIDErr).Once()
			}

			b := &DashboardsAPIBuilder{
				dashboardService: svc,
				QuotaService:     quotatest.New(false, nil),
				isStandalone:     tt.isStandalone,
			}

			ctx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1})
			err := b.Validate(ctx, admission.NewAttributesRecord(
				inputObj,
				nil,
				dashv1.DashboardResourceInfo.GroupVersionKind(),
				inputObj.Namespace,
				inputObj.Name,
				dashv1.DashboardResourceInfo.GroupVersionResource(),
				"",
				admission.Create,
				&metav1.CreateOptions{},
				tt.dryRun,
				&user.SignedInUser{UserID: 1, OrgID: 1},
			), nil)

			switch {
			case tt.expectConflict:
				require.Error(t, err)
				require.True(t, apierrors.IsConflict(err), "expected Conflict, got %T: %v", err, err)
			case tt.expectGenericFail:
				require.Error(t, err)
				require.False(t, apierrors.IsConflict(err), "expected non-Conflict error, got %v", err)
			default:
				require.NoError(t, err)
			}

			if !tt.expectGetUIDCall {
				svc.AssertNotCalled(t, "GetDashboardUIDByID", mock.Anything, mock.Anything)
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
