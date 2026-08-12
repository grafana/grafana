package dashboard

import (
	"context"
	"fmt"
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	types "k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/admission"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
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

// TestCodecPathResourcesRegisterOneVersionPerType guards apimachinery's LegacyCodec version-order
// fallback (see assertNoTypeSpansMultipleGVKs).
func TestCodecPathResourcesRegisterOneVersionPerType(t *testing.T) {
	migration.ResetForTesting()
	migration.Initialize(testutil.NewDataSourceProvider(testutil.StandardTestConfig), testutil.NewLibraryElementProvider(), migration.DefaultCacheTTL)

	scheme := runtime.NewScheme()
	b := &DashboardsAPIBuilder{}
	require.NoError(t, b.InstallSchema(scheme))

	assertNoTypeSpansMultipleGVKs(t, scheme)
}

// commonMultiVersionTypes are known-safe exceptions to assertNoTypeSpansMultipleGVKs: k8s bookkeeping
// types every group-version registers by convention (never round-trip through Storage.Create), plus
// v1beta1's documented type aliases to v1 (Dashboard's StorageOptions sets Scheme, so it never takes
// the codec path anyway; DashboardWithAccessInfo is a read-only /dto response, also never written).
// Add here on exception basis with a description.
var commonMultiVersionTypes = func() map[reflect.Type]bool {
	m := map[reflect.Type]bool{}
	for _, o := range []runtime.Object{
		&metav1.WatchEvent{}, &metav1.InternalEvent{}, &metav1.ListOptions{}, &metav1.GetOptions{},
		&metav1.DeleteOptions{}, &metav1.CreateOptions{}, &metav1.UpdateOptions{}, &metav1.PatchOptions{},
		&metav1.PartialObjectMetadata{}, &metav1.PartialObjectMetadataList{},
		&dashv1.Dashboard{}, &dashv1.DashboardList{}, &dashv1.DashboardWithAccessInfo{},
	} {
		m[reflect.TypeOf(o).Elem()] = true
	}
	return m
}()

// assertNoTypeSpansMultipleGVKs fails if any type a real InstallSchema registers has 2+
// GroupVersionKinds, or is registered at runtime.APIVersionInternal at all. Either shape activates
// apimachinery's LegacyCodec order-fallback (a type sharing a GVK with the internal version, or with
// another external version, has no exact match in the codec's version list), which would let
// preferred_api_version silently pick the persisted version instead of only discovery order. A
// same-struct hub isn't required: a distinct internal-only struct plus distinct external structs hits
// the same fallback, since the fallback keys on the object's own GVK never exactly matching the
// codec's target list, not on the Go type being reused. Walks every registered type rather than a
// hardcoded list, so a new resource is covered too.
func assertNoTypeSpansMultipleGVKs(t *testing.T, scheme *runtime.Scheme) {
	t.Helper()
	byType := map[reflect.Type][]schema.GroupVersionKind{}
	for gvk, typ := range scheme.AllKnownTypes() {
		if commonMultiVersionTypes[typ] {
			continue
		}
		obj, ok := reflect.New(typ).Interface().(runtime.Object)
		if !ok {
			continue
		}
		if unversioned, ok := scheme.IsUnversioned(obj); ok && unversioned {
			continue // e.g. metav1.Status - genuinely version-independent, not a codec-fallback risk
		}
		require.NotEqualf(t, runtime.APIVersionInternal, gvk.Version,
			"%s is registered at the internal version (%v) - a hub type never exactly matches any "+
				"external version in the LegacyCodec's list, so encoding it always hits the "+
				"order-fallback and lets preferred_api_version pick the persisted version", typ, gvk)
		byType[typ] = append(byType[typ], gvk)
	}
	for typ, gvks := range byType {
		require.Lenf(t, gvks, 1,
			"%s is registered at %v - a Go type shared across group versions activates the LegacyCodec "+
				"order-fallback, so preferred_api_version would now silently pick the persisted version "+
				"for this type instead of only ordering API discovery", typ, gvks)
	}
}
