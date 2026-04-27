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
	// notFoundGR controls the GroupResource used for the synthetic NotFound
	// error so folder mocks raise folder.grafana.app/folders not-found rather
	// than the dashboard default.
	notFoundGR *schema.GroupResource
}

func (m *mockGetByName) Get(_ context.Context, name string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	if err, ok := m.getErr[name]; ok {
		return nil, err
	}
	if item, ok := m.items[name]; ok {
		return item, nil
	}
	gr := schema.GroupResource{
		Group:    resources.DashboardResource.Group,
		Resource: resources.DashboardResource.Resource,
	}
	if m.notFoundGR != nil {
		gr = *m.notFoundGR
	}
	return nil, apierrors.NewNotFound(gr, name)
}

// mockListClient lists every item it was constructed with on every List call.
// It satisfies the slice of dynamic.ResourceInterface methods that ForEach
// touches: List with continue-token paging (we always return the full set in
// one page) and the embedded ResourceInterface for everything else.
type mockListClient struct {
	dynamic.ResourceInterface
	items []unstructured.Unstructured
}

func (m *mockListClient) List(_ context.Context, _ metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	return &unstructured.UnstructuredList{Items: m.items}, nil
}

// emptyFolderClient is the no-op client used by tests that only exercise the
// dashboard path so the folder-tree load short-circuits to an empty tree.
func emptyFolderClient() dynamic.ResourceInterface {
	return &mockListClient{items: nil}
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

// dashboardObjectInFolder is a non-managed dashboard whose grafana.app/folder
// annotation places it inside the named folder UID. The folder-recursive
// export filters the namespace dashboard list by exactly this annotation.
func dashboardObjectInFolder(name, folderUID string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": resources.DashboardResource.GroupVersion().String(),
			"kind":       "Dashboard",
			"metadata": map[string]any{
				"name": name,
				"annotations": map[string]any{
					"grafana.app/folder": folderUID,
				},
			},
		},
	}
}

// folderObject builds an unmanaged folder K8s object with the given UID and
// parent folder UID (empty string for top-level). Used to seed the folder
// listing the export reads via ForEach.
func folderObject(uid, parentUID string) unstructured.Unstructured {
	annotations := map[string]any{}
	if parentUID != "" {
		annotations["grafana.app/folder"] = parentUID
	}
	return unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "folder.grafana.app/v1beta1",
			"kind":       "Folder",
			"metadata": map[string]any{
				"name":        uid,
				"annotations": annotations,
			},
			"spec": map[string]any{
				"title": uid,
			},
		},
	}
}

// managedFolderObject is the same as folderObject but with manager annotations
// so the export skips it in the unmanaged listing pass.
func managedFolderObject(uid, parentUID, managerID string) unstructured.Unstructured {
	annotations := map[string]any{
		"grafana.app/managedBy": "repo",
		"grafana.app/managerId": managerID,
	}
	if parentUID != "" {
		annotations["grafana.app/folder"] = parentUID
	}
	return unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "folder.grafana.app/v1beta1",
			"kind":       "Folder",
			"metadata": map[string]any{
				"name":        uid,
				"annotations": annotations,
			},
			"spec": map[string]any{
				"title": uid,
			},
		},
	}
}

func dashboardGVK() schema.GroupVersionKind {
	return schema.GroupVersionKind{
		Group: resources.DashboardResource.Group,
		Kind:  "Dashboard",
	}
}

func folderNotFoundGR() *schema.GroupResource {
	return &schema.GroupResource{
		Group:    resources.FolderResource.Group,
		Resource: resources.FolderResource.Resource,
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

	err := ExportSpecificResources(context.Background(), options, resourceClients, emptyFolderClient(), repoResources, progress, false)
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

	err := ExportSpecificResources(context.Background(), options, resourceClients, emptyFolderClient(), repoResources, progress, false)
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

	err := ExportSpecificResources(context.Background(), options, resourceClients, emptyFolderClient(), repoResources, progress, false)
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

	err := ExportSpecificResources(context.Background(), options, resourceClients, emptyFolderClient(), repoResources, progress, false)
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

	err := ExportSpecificResources(context.Background(), options, resourceClients, emptyFolderClient(), repoResources, progress, true)
	require.NoError(t, err)
	require.NotEmpty(t, writtenName)
	require.NotEqual(t, "original-uid", writtenName, "generateNewUIDs=true should have rewritten the object name")
}

// TestExportSpecificResources_UnsupportedKindIsErroredAndSkipped pins the
// behavior for kinds outside the validator's allow-list (admission would
// normally reject them, but a request that bypasses admission still escalates
// the job rather than silently dropping the ref).
func TestExportSpecificResources_UnsupportedKindIsErroredAndSkipped(t *testing.T) {
	resourceClients := resources.NewMockResourceClients(t)
	repoResources := resources.NewMockRepositoryResources(t)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, "start selective resource export").Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "panel-1" && r.Action() != repository.FileActionIgnored && r.Error() != nil
	})).Return()
	progress.On("TooManyErrors").Return(nil).Once()

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{{Name: "panel-1", Kind: "LibraryPanel"}},
	}

	err := ExportSpecificResources(context.Background(), options, resourceClients, emptyFolderClient(), repoResources, progress, false)
	require.NoError(t, err)
	repoResources.AssertNotCalled(t, "WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything)
}

// TestExportSpecificResources_FolderRefExportsSubtree covers the happy path
// for recursive folder export: the folder hierarchy is parent/child/grandchild
// with one dashboard in each, plus a sibling folder whose dashboard must NOT
// be exported because it lives outside the requested subtree.
func TestExportSpecificResources_FolderRefExportsSubtree(t *testing.T) {
	dashboards := []unstructured.Unstructured{
		// In the requested subtree
		*dashboardObjectInFolder("dash-parent", "parent"),
		*dashboardObjectInFolder("dash-child", "child"),
		*dashboardObjectInFolder("dash-grandchild", "grandchild"),
		// Outside the subtree — sibling folder
		*dashboardObjectInFolder("dash-sibling", "sibling"),
	}
	dashListClient := &mockListClient{items: dashboards}
	dashGetClient := &mockGetByName{items: map[string]*unstructured.Unstructured{}}
	// Combine list + get so ForKind can return one client that satisfies both.
	dashClient := &dashGetListClient{getter: dashGetClient, lister: dashListClient}

	folderClient := &mockListClient{items: []unstructured.Unstructured{
		folderObject("parent", ""),
		folderObject("child", "parent"),
		folderObject("grandchild", "child"),
		folderObject("sibling", ""),
	}}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, dashboardGVK()).
		Return(dashClient, resources.DashboardResource, nil)

	repoResources := resources.NewMockRepositoryResources(t)
	repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		return obj.GetName() == "dash-parent"
	}), mock.Anything).Return("parent/dash-parent.json", nil)
	repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		return obj.GetName() == "dash-child"
	}), mock.Anything).Return("parent/child/dash-child.json", nil)
	repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		return obj.GetName() == "dash-grandchild"
	}), mock.Anything).Return("parent/child/grandchild/dash-grandchild.json", nil)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, mock.Anything).Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "dash-parent" && r.Action() == repository.FileActionCreated && r.Error() == nil
	})).Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "dash-child" && r.Action() == repository.FileActionCreated && r.Error() == nil
	})).Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "dash-grandchild" && r.Action() == repository.FileActionCreated && r.Error() == nil
	})).Return()
	progress.On("TooManyErrors").Return(nil)

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{{Name: "parent", Kind: "Folder"}},
	}

	err := ExportSpecificResources(context.Background(), options, resourceClients, folderClient, repoResources, progress, false)
	require.NoError(t, err)
	repoResources.AssertNotCalled(t, "WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		return obj.GetName() == "dash-sibling"
	}), mock.Anything)
}

// TestExportSpecificResources_FolderRefNotFound asserts that a folder ref the
// API does not know about is recorded as an error so the job escalates.
func TestExportSpecificResources_FolderRefNotFound(t *testing.T) {
	dashClient := &dashGetListClient{
		getter: &mockGetByName{items: map[string]*unstructured.Unstructured{}},
		lister: &mockListClient{},
	}

	folderClient := &folderClientStub{
		listClient: &mockListClient{},
		getClient:  &mockGetByName{items: map[string]*unstructured.Unstructured{}, notFoundGR: folderNotFoundGR()},
	}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, dashboardGVK()).
		Return(dashClient, resources.DashboardResource, nil)
	repoResources := resources.NewMockRepositoryResources(t)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, mock.Anything).Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "missing-folder" && r.Action() != repository.FileActionIgnored && r.Error() != nil
	})).Return()
	progress.On("TooManyErrors").Return(nil)

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{{Name: "missing-folder", Kind: "Folder"}},
	}

	err := ExportSpecificResources(context.Background(), options, resourceClients, folderClient, repoResources, progress, false)
	require.NoError(t, err)
	repoResources.AssertNotCalled(t, "WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything)
}

// TestExportSpecificResources_FolderRefManagedRecordsError covers the case
// where a requested folder exists but is owned by another repository: it is
// missing from the unmanaged listing, the Get call returns it with manager
// annotations, and the export records a per-folder error.
func TestExportSpecificResources_FolderRefManagedRecordsError(t *testing.T) {
	managedFolder := managedFolderObject("managed-folder", "", "other-repo")
	folderClient := &folderClientStub{
		listClient: &mockListClient{items: []unstructured.Unstructured{managedFolder}},
		getClient: &mockGetByName{items: map[string]*unstructured.Unstructured{
			"managed-folder": &managedFolder,
		}},
	}
	dashClient := &dashGetListClient{
		getter: &mockGetByName{items: map[string]*unstructured.Unstructured{}},
		lister: &mockListClient{},
	}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, dashboardGVK()).
		Return(dashClient, resources.DashboardResource, nil)
	repoResources := resources.NewMockRepositoryResources(t)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, mock.Anything).Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "managed-folder" && r.Action() != repository.FileActionIgnored && r.Error() != nil
	})).Return()
	progress.On("TooManyErrors").Return(nil)

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{{Name: "managed-folder", Kind: "Folder"}},
	}

	err := ExportSpecificResources(context.Background(), options, resourceClients, folderClient, repoResources, progress, false)
	require.NoError(t, err)
	repoResources.AssertNotCalled(t, "WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything)
}

// TestExportSpecificResources_FolderRefManagedDashboardEscalates locks in the
// product decision: a dashboard inside an explicitly-requested folder that is
// owned by another repository must surface as a per-dashboard error, not a
// silent skip — the caller asked for that folder's contents.
func TestExportSpecificResources_FolderRefManagedDashboardEscalates(t *testing.T) {
	dashboards := []unstructured.Unstructured{
		*dashboardObjectInFolder("ok-dash", "parent"),
		*func() *unstructured.Unstructured {
			obj := managedDashboardObject("managed-inside", "other-repo")
			meta := obj.Object["metadata"].(map[string]any)
			meta["annotations"].(map[string]any)["grafana.app/folder"] = "parent"
			return obj
		}(),
	}
	dashClient := &dashGetListClient{
		getter: &mockGetByName{items: map[string]*unstructured.Unstructured{}},
		lister: &mockListClient{items: dashboards},
	}
	folderClient := &mockListClient{items: []unstructured.Unstructured{
		folderObject("parent", ""),
	}}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, dashboardGVK()).
		Return(dashClient, resources.DashboardResource, nil)

	repoResources := resources.NewMockRepositoryResources(t)
	repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		return obj.GetName() == "ok-dash"
	}), mock.Anything).Return("parent/ok-dash.json", nil)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, mock.Anything).Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "ok-dash" && r.Action() == repository.FileActionCreated && r.Error() == nil
	})).Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "managed-inside" && r.Action() != repository.FileActionIgnored && r.Error() != nil
	})).Return()
	progress.On("TooManyErrors").Return(nil)

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{{Name: "parent", Kind: "Folder"}},
	}

	err := ExportSpecificResources(context.Background(), options, resourceClients, folderClient, repoResources, progress, false)
	require.NoError(t, err)
}

// TestExportSpecificResources_MixedDashboardAndFolderRefs ensures that when
// a request mixes Dashboard and Folder refs both paths run and all expected
// resources are written.
func TestExportSpecificResources_MixedDashboardAndFolderRefs(t *testing.T) {
	folderListing := []unstructured.Unstructured{folderObject("team-folder", "")}
	dashboardsInNamespace := []unstructured.Unstructured{
		*dashboardObjectInFolder("inside-folder", "team-folder"),
		*dashboardObject("standalone-dash"), // not in any folder
		*dashboardObjectInFolder("unrelated", "another-folder"),
	}

	dashClient := &dashGetListClient{
		getter: &mockGetByName{items: map[string]*unstructured.Unstructured{
			"standalone-dash": dashboardObject("standalone-dash"),
		}},
		lister: &mockListClient{items: dashboardsInNamespace},
	}
	folderClient := &mockListClient{items: folderListing}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, dashboardGVK()).
		Return(dashClient, resources.DashboardResource, nil)

	repoResources := resources.NewMockRepositoryResources(t)
	repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		return obj.GetName() == "standalone-dash"
	}), mock.Anything).Return("standalone-dash.json", nil)
	repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		return obj.GetName() == "inside-folder"
	}), mock.Anything).Return("team-folder/inside-folder.json", nil)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, mock.Anything).Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "standalone-dash" && r.Action() == repository.FileActionCreated && r.Error() == nil
	})).Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "inside-folder" && r.Action() == repository.FileActionCreated && r.Error() == nil
	})).Return()
	progress.On("TooManyErrors").Return(nil)

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{
			{Name: "standalone-dash", Kind: "Dashboard"},
			{Name: "team-folder", Kind: "Folder"},
		},
	}

	err := ExportSpecificResources(context.Background(), options, resourceClients, folderClient, repoResources, progress, false)
	require.NoError(t, err)
	repoResources.AssertNotCalled(t, "WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		return obj.GetName() == "unrelated"
	}), mock.Anything)
}

// dashGetListClient bridges Get-by-name (used for dashboard refs) and
// List-all (used for folder-recursive expansion) onto one mock so ForKind can
// return a single dashboard client object.
type dashGetListClient struct {
	dynamic.ResourceInterface
	getter *mockGetByName
	lister *mockListClient
}

func (c *dashGetListClient) Get(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	return c.getter.Get(ctx, name, opts, subresources...)
}

func (c *dashGetListClient) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	return c.lister.List(ctx, opts)
}

// folderClientStub combines a List-all view of folders with a Get-by-name
// view, mirroring how the production folder client behaves.
type folderClientStub struct {
	dynamic.ResourceInterface
	listClient *mockListClient
	getClient  *mockGetByName
}

func (c *folderClientStub) Get(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	return c.getClient.Get(ctx, name, opts, subresources...)
}

func (c *folderClientStub) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	return c.listClient.List(ctx, opts)
}
