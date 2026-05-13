package export

import (
	"context"
	"fmt"
	"testing"

	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	provisioningV0 "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// mockGetByName is a dynamic.ResourceInterface stub that returns items from a
// name-indexed map. Names not present trigger apierrors.NewNotFound so callers
// can exercise the not-found branch in ExportSpecificResources.
type mockGetByName struct {
	dynamic.ResourceInterface
	items map[string]*unstructured.Unstructured
	// getErr overrides the per-name response with a specific error (e.g., a
	// non-NotFound API error) when set.
	getErr map[string]error
}

func (m *mockGetByName) Get(_ context.Context, name string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	if err, ok := m.getErr[name]; ok {
		return nil, err
	}
	if item, ok := m.items[name]; ok {
		return item, nil
	}
	return nil, apierrors.NewNotFound(schema.GroupResource{
		Group:    resources.DashboardResource.Group,
		Resource: resources.DashboardResource.Resource,
	}, name)
}

func managedDashboardObject(name, managerID string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": resources.DashboardResource.GroupVersion().String(),
			"kind":       "Dashboard",
			"metadata": map[string]any{
				"name": name,
				"annotations": map[string]any{
					// annotation keys used by utils.MetaAccessor().GetManagerProperties()
					"grafana.app/managedBy": "repo",
					"grafana.app/managerId": managerID,
				},
			},
		},
	}
}

func dashboardObject(name string) *unstructured.Unstructured {
	obj := createDashboardObject(name)
	return &obj
}

func dashboardGVK() schema.GroupVersionKind {
	return schema.GroupVersionKind{
		Group: resources.DashboardResource.Group,
		Kind:  "Dashboard",
	}
}

func TestExportSpecificResources_Success(t *testing.T) {
	dashClient := &mockGetByName{items: map[string]*unstructured.Unstructured{
		"dash-1": dashboardObject("dash-1"),
		"dash-2": dashboardObject("dash-2"),
	}}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, dashboardGVK()).
		Return(dashClient, resources.DashboardResource, nil)

	repoResources := resources.NewMockRepositoryResources(t)
	writeOpts := resources.WriteOptions{Path: "grafana", Ref: "feature/branch"}
	repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		return obj.GetName() == "dash-1"
	}), writeOpts).Return("dash-1.json", nil)
	repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		return obj.GetName() == "dash-2"
	}), writeOpts).Return("dash-2.json", nil)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, "start selective resource export").Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "dash-1" && r.Action() == repository.FileActionCreated
	})).Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "dash-2" && r.Action() == repository.FileActionCreated
	})).Return()
	progress.On("TooManyErrors").Return(nil).Times(2)

	options := provisioningV0.ExportJobOptions{
		Path:   "grafana",
		Branch: "feature/branch",
		Resources: []provisioningV0.ResourceRef{
			{Name: "dash-1", Kind: "Dashboard"},
			{Name: "dash-2", Kind: "Dashboard"},
		},
	}

	err := ExportSpecificResources(context.Background(), options, resourceClients, repoResources, progress, false)
	require.NoError(t, err)
}

func TestExportSpecificResources_ManagedDashboardError(t *testing.T) {
	dashClient := &mockGetByName{items: map[string]*unstructured.Unstructured{
		"managed-dash": managedDashboardObject("managed-dash", "other-repo"),
	}}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, dashboardGVK()).
		Return(dashClient, resources.DashboardResource, nil)

	repoResources := resources.NewMockRepositoryResources(t)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, "start selective resource export").Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		// Caller named a dashboard that another manager already owns: the
		// export cannot fulfil the request, so the result must carry an error
		// (not a warning) so the job surfaces the failure. The action is NOT
		// Ignored because the recorder silently discards errors on ignored
		// results — we need this one to escalate the job state.
		return r.Name() == "managed-dash" &&
			r.Action() != repository.FileActionIgnored &&
			r.Error() != nil
	})).Return()
	progress.On("TooManyErrors").Return(nil).Once()

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{{Name: "managed-dash", Kind: "Dashboard"}},
	}

	err := ExportSpecificResources(context.Background(), options, resourceClients, repoResources, progress, false)
	require.NoError(t, err)
	repoResources.AssertNotCalled(t, "WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything)
}

func TestExportSpecificResources_NotFoundRecordsError(t *testing.T) {
	dashClient := &mockGetByName{items: map[string]*unstructured.Unstructured{}}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, dashboardGVK()).
		Return(dashClient, resources.DashboardResource, nil)

	repoResources := resources.NewMockRepositoryResources(t)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, "start selective resource export").Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		// Caller named a dashboard that does not exist: the export cannot
		// fulfil the request, so the job must surface an error rather than
		// silently drop the reference. The action is NOT Ignored because the
		// recorder silently discards errors on ignored results — we need
		// this one to escalate the job state.
		return r.Name() == "missing" && r.Action() != repository.FileActionIgnored && r.Error() != nil
	})).Return()
	progress.On("TooManyErrors").Return(nil).Once()

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{{Name: "missing", Kind: "Dashboard"}},
	}

	err := ExportSpecificResources(context.Background(), options, resourceClients, repoResources, progress, false)
	require.NoError(t, err)
	repoResources.AssertNotCalled(t, "WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything)
}

func TestExportSpecificResources_GetErrorRecordsError(t *testing.T) {
	dashClient := &mockGetByName{
		items:  map[string]*unstructured.Unstructured{},
		getErr: map[string]error{"boom": fmt.Errorf("transport broke")},
	}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, dashboardGVK()).
		Return(dashClient, resources.DashboardResource, nil)

	repoResources := resources.NewMockRepositoryResources(t)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, "start selective resource export").Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "boom" && r.Action() != repository.FileActionIgnored && r.Error() != nil
	})).Return()
	progress.On("TooManyErrors").Return(nil).Once()

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{{Name: "boom", Kind: "Dashboard"}},
	}

	err := ExportSpecificResources(context.Background(), options, resourceClients, repoResources, progress, false)
	require.NoError(t, err)
}

func TestExportSpecificResources_NewUIDsSetsRandomName(t *testing.T) {
	dashClient := &mockGetByName{items: map[string]*unstructured.Unstructured{
		"original-uid": dashboardObject("original-uid"),
	}}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, dashboardGVK()).
		Return(dashClient, resources.DashboardResource, nil)

	var writtenName string
	repoResources := resources.NewMockRepositoryResources(t)
	repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		writtenName = obj.GetName()
		return true
	}), mock.Anything).Return("generated.json", nil)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, mock.Anything).Return()
	progress.On("Record", mock.Anything, mock.Anything).Return()
	progress.On("TooManyErrors").Return(nil).Once()

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{{Name: "original-uid", Kind: "Dashboard"}},
	}

	err := ExportSpecificResources(context.Background(), options, resourceClients, repoResources, progress, true)
	require.NoError(t, err)
	require.NotEmpty(t, writtenName)
	require.NotEqual(t, "original-uid", writtenName, "generateNewUIDs=true should have rewritten the object name")
}

func TestExportSpecificResources_NonDashboardKindIsErroredAndSkipped(t *testing.T) {
	// ForKind still gets called once at the top of ExportSpecificResources so
	// the shim can be prepared, even though no dashboards end up being fetched.
	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, dashboardGVK()).
		Return(&mockGetByName{items: map[string]*unstructured.Unstructured{}}, resources.DashboardResource, nil)

	repoResources := resources.NewMockRepositoryResources(t)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, "start selective resource export").Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		// A non-Dashboard kind is a caller mistake (admission would normally
		// reject it); if it still reaches the worker, fail the item rather
		// than quietly warn so the job surfaces the bad input. The action is
		// NOT Ignored because the recorder silently discards errors on
		// ignored results — we need this one to escalate the job state.
		return r.Name() == "folder-ref" && r.Action() != repository.FileActionIgnored && r.Error() != nil
	})).Return()
	progress.On("TooManyErrors").Return(nil).Once()

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{{Name: "folder-ref", Kind: "Folder"}},
	}

	err := ExportSpecificResources(context.Background(), options, resourceClients, repoResources, progress, false)
	require.NoError(t, err)
	repoResources.AssertNotCalled(t, "WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything)
}
