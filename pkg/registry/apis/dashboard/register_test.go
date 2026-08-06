package dashboard

import (
	"context"
	"fmt"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	types "k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/admission"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	apiserverbuilder "github.com/grafana/grafana/pkg/services/apiserver/builder"
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

func TestDashboardAPIBuilder_StandaloneLibraryPanelAdmissionEnforcesAccess(t *testing.T) {
	requester := &identity.StaticRequester{
		Type:      authlib.TypeServiceAccount,
		UserID:    42,
		UserUID:   "viewer-service-account",
		OrgID:     1,
		Namespace: "stacks-1",
	}

	tests := []struct {
		name           string
		operation      admission.Operation
		expectedVerb   string
		folderUID      string
		expectedFolder string
	}{
		{
			name:           "create in a folder",
			operation:      admission.Create,
			expectedVerb:   utils.VerbCreate,
			folderUID:      "folder-a",
			expectedFolder: "folder-a",
		},
		{
			name:           "update at the root",
			operation:      admission.Update,
			expectedVerb:   utils.VerbUpdate,
			expectedFolder: accesscontrol.GeneralFolderUID,
		},
		{
			name:           "delete from a folder",
			operation:      admission.Delete,
			expectedVerb:   utils.VerbDelete,
			folderUID:      "folder-b",
			expectedFolder: "folder-b",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotIdentity authlib.AuthInfo
			var gotRequest authlib.CheckRequest
			var gotFolder string
			accessClient := &recordingAccessClient{
				check: func(_ context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
					gotIdentity = info
					gotRequest = req
					gotFolder = folder
					return authlib.CheckResponse{Allowed: false, Zookie: authlib.NoopZookie{}}, nil
				},
			}
			dashboardBuilder := NewAPIService(
				accessClient,
				nil,
				nil,
				migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig),
				migrationtestutil.NewLibraryElementProvider(),
				nil,
				nil,
				nil,
			)
			require.True(t, dashboardBuilder.isStandalone)
			admissionPlugin := apiserverbuilder.NewAdmissionFromBuilders([]apiserverbuilder.APIGroupBuilder{dashboardBuilder})

			panel := &dashv0.LibraryPanel{
				TypeMeta: metav1.TypeMeta{
					APIVersion: dashv0.LibraryPanelResourceInfo.GroupVersion().String(),
					Kind:       dashv0.LibraryPanelResourceInfo.GroupVersionKind().Kind,
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:      "panel-a",
					Namespace: "stacks-1",
				},
			}
			if tt.folderUID != "" {
				panel.SetAnnotations(map[string]string{utils.AnnoKeyFolder: tt.folderUID})
			}

			var object, oldObject runtime.Object
			switch tt.operation {
			case admission.Delete:
				oldObject = panel
			case admission.Update:
				object = panel
				oldObject = panel.DeepCopy()
			default:
				object = panel
			}
			ctx := identity.WithRequester(context.Background(), requester)
			err := admissionPlugin.Validate(ctx, admission.NewAttributesRecord(
				object,
				oldObject,
				dashv0.LibraryPanelResourceInfo.GroupVersionKind(),
				"stacks-1",
				panel.Name,
				dashv0.LibraryPanelResourceInfo.GroupVersionResource(),
				"",
				tt.operation,
				nil,
				false,
				requester,
			), nil)

			require.True(t, apierrors.IsForbidden(err), "standalone admission must reject a denied %s", tt.operation)
			require.Same(t, requester, gotIdentity)
			require.Equal(t, authlib.CheckRequest{
				Verb:      tt.expectedVerb,
				Group:     dashv0.LibraryPanelResourceInfo.GroupVersionResource().Group,
				Resource:  dashv0.LibraryPanelResourceInfo.GroupVersionResource().Resource,
				Namespace: "stacks-1",
				Name:      "panel-a",
			}, gotRequest)
			require.Equal(t, tt.expectedFolder, gotFolder)
		})
	}
}

func TestDashboardAPIBuilder_StandaloneLibraryPanelMoveRequiresSourceAndDestinationAccess(t *testing.T) {
	requester := &identity.StaticRequester{
		Type:      authlib.TypeServiceAccount,
		UserID:    42,
		UserUID:   "folder-limited-service-account",
		OrgID:     1,
		Namespace: "stacks-1",
	}
	checkedFolders := make([]string, 0, 2)
	accessClient := &recordingAccessClient{
		check: func(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			require.Equal(t, utils.VerbUpdate, req.Verb)
			checkedFolders = append(checkedFolders, folder)
			return authlib.CheckResponse{Allowed: folder == "source-folder", Zookie: authlib.NoopZookie{}}, nil
		},
	}
	dashboardBuilder := NewAPIService(
		accessClient,
		nil,
		nil,
		migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig),
		migrationtestutil.NewLibraryElementProvider(),
		nil,
		nil,
		nil,
	)
	admissionPlugin := apiserverbuilder.NewAdmissionFromBuilders([]apiserverbuilder.APIGroupBuilder{dashboardBuilder})

	oldPanel := &dashv0.LibraryPanel{ObjectMeta: metav1.ObjectMeta{
		Name:        "panel-a",
		Namespace:   "stacks-1",
		Annotations: map[string]string{utils.AnnoKeyFolder: "source-folder"},
	}}
	updatedPanel := oldPanel.DeepCopy()
	updatedPanel.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "destination-folder"})
	ctx := identity.WithRequester(context.Background(), requester)
	err := admissionPlugin.Validate(ctx, admission.NewAttributesRecord(
		updatedPanel,
		oldPanel,
		dashv0.LibraryPanelResourceInfo.GroupVersionKind(),
		"stacks-1",
		updatedPanel.Name,
		dashv0.LibraryPanelResourceInfo.GroupVersionResource(),
		"",
		admission.Update,
		nil,
		false,
		requester,
	), nil)

	require.True(t, apierrors.IsForbidden(err), "moving a panel must require destination-folder access")
	require.Equal(t, []string{"source-folder", "destination-folder"}, checkedFolders)
}

type recordingAccessClient struct {
	check func(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error)
}

func (c *recordingAccessClient) Check(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return c.check(ctx, info, req, folder)
}

func (c *recordingAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, authlib.NoopZookie{}, nil
}

func (c *recordingAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, _ authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
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
