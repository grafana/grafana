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

// emptyFolderClient returns a folder client with no folders. It is used by the
// tests whose resources live at the root, where ExportSpecificResources never
// needs to resolve a folder ancestry.
func emptyFolderClient() *mockGetByName {
	return &mockGetByName{items: map[string]*unstructured.Unstructured{}}
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

// dashboardInFolder returns a dashboard whose parent folder annotation points at
// folderUID, exercising the folder-ancestry export path.
func dashboardInFolder(name, folderUID string) *unstructured.Unstructured {
	obj := dashboardObject(name)
	meta := obj.Object["metadata"].(map[string]any)
	meta["annotations"] = map[string]any{"grafana.app/folder": folderUID}
	return obj
}

// folderObject returns a folder with the given parent (pass "" for a root
// folder). The spec title doubles as the path segment when the tree derives the
// folder path from its ancestors.
func folderObject(name, parentUID string) *unstructured.Unstructured {
	metadata := map[string]any{"name": name}
	if parentUID != "" {
		metadata["annotations"] = map[string]any{"grafana.app/folder": parentUID}
	}
	return &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": resources.FolderResource.GroupVersion().String(),
			"kind":       "Folder",
			"metadata":   metadata,
			"spec":       map[string]any{"title": name},
		},
	}
}

func dashboardGVK() schema.GroupVersionKind {
	return schema.GroupVersionKind{
		Group: resources.DashboardResource.Group,
		Kind:  "Dashboard",
	}
}

func folderGVK() schema.GroupVersionKind {
	return schema.GroupVersionKind{Group: resources.FolderResource.Group, Kind: resources.FolderKind.Kind}
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
			{Name: "dash-1", Kind: "Dashboard", Group: resources.DashboardResource.Group},
			{Name: "dash-2", Kind: "Dashboard", Group: resources.DashboardResource.Group},
		},
	}

	err := ExportSpecificResources(context.Background(), options, emptyFolderClient(), resourceClients, repoResources, progress, false)
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
		Resources: []provisioningV0.ResourceRef{{Name: "managed-dash", Kind: "Dashboard", Group: resources.DashboardResource.Group}},
	}

	err := ExportSpecificResources(context.Background(), options, emptyFolderClient(), resourceClients, repoResources, progress, false)
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
		Resources: []provisioningV0.ResourceRef{{Name: "missing", Kind: "Dashboard", Group: resources.DashboardResource.Group}},
	}

	err := ExportSpecificResources(context.Background(), options, emptyFolderClient(), resourceClients, repoResources, progress, false)
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
		Resources: []provisioningV0.ResourceRef{{Name: "boom", Kind: "Dashboard", Group: resources.DashboardResource.Group}},
	}

	err := ExportSpecificResources(context.Background(), options, emptyFolderClient(), resourceClients, repoResources, progress, false)
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
		Resources: []provisioningV0.ResourceRef{{Name: "original-uid", Kind: "Dashboard", Group: resources.DashboardResource.Group}},
	}

	err := ExportSpecificResources(context.Background(), options, emptyFolderClient(), resourceClients, repoResources, progress, true)
	require.NoError(t, err)
	require.NotEmpty(t, writtenName)
	require.NotEqual(t, "original-uid", writtenName, "generateNewUIDs=true should have rewritten the object name")
}

// TestExportSpecificResources_FolderKindIsExported verifies that an explicitly
// named folder is written via the folder tree (with its full ancestry) rather
// than being skipped: "don't export folders unless they are passed" implies a
// passed folder is exported.
func TestExportSpecificResources_FolderKindIsExported(t *testing.T) {
	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, folderGVK()).
		Return(emptyFolderClient(), resources.FolderResource, nil)

	// child sits under parent; both ancestors are recreated from the folder API.
	folderClient := &mockGetByName{items: map[string]*unstructured.Unstructured{
		"child":  folderObject("child", "parent"),
		"parent": folderObject("parent", ""),
	}}

	repoResources := resources.NewMockRepositoryResources(t)
	repoResources.On("EnsureFolderTreeExists", mock.Anything, "feature/branch", "", mock.MatchedBy(func(tree resources.FolderTree) bool {
		return tree.Count() == 2
	}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
		require.NoError(t, fn(resources.Folder{ID: "parent", Path: "parent"}, true, nil))
		require.NoError(t, fn(resources.Folder{ID: "child", Path: "parent/child"}, true, nil))
		return true
	})).Return(nil)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, "start selective resource export").Return()
	progress.On("SetMessage", mock.Anything, "export folders for selected resources").Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "parent" && r.Action() == repository.FileActionCreated
	})).Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "child" && r.Action() == repository.FileActionCreated
	})).Return()
	progress.On("TooManyErrors").Return(nil)

	options := provisioningV0.ExportJobOptions{
		Branch:    "feature/branch",
		Resources: []provisioningV0.ResourceRef{{Name: "child", Kind: resources.FolderKind.Kind, Group: resources.FolderResource.Group}},
	}

	err := ExportSpecificResources(context.Background(), options, folderClient, resourceClients, repoResources, progress, false)
	require.NoError(t, err)
	repoResources.AssertNotCalled(t, "WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything)
}

// TestExportSpecificResources_GeneratesFolderForDashboard verifies the core
// fix: a dashboard whose folder was NOT named still has that folder (and its
// ancestry) generated from the folder API so the dashboard lands at its nested
// path, instead of dragging in the whole instance tree or failing to resolve.
func TestExportSpecificResources_GeneratesFolderForDashboard(t *testing.T) {
	dashClient := &mockGetByName{items: map[string]*unstructured.Unstructured{
		"dash-1": dashboardInFolder("dash-1", "child"),
	}}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, dashboardGVK()).
		Return(dashClient, resources.DashboardResource, nil)

	folderClient := &mockGetByName{items: map[string]*unstructured.Unstructured{
		"child":  folderObject("child", "parent"),
		"parent": folderObject("parent", ""),
	}}

	repoResources := resources.NewMockRepositoryResources(t)
	// Both ancestor folders are assembled into the tree before the dashboard is
	// written.
	repoResources.On("EnsureFolderTreeExists", mock.Anything, "feature/branch", "", mock.MatchedBy(func(tree resources.FolderTree) bool {
		return tree.Count() == 2
	}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
		require.NoError(t, fn(resources.Folder{ID: "parent", Path: "parent"}, true, nil))
		require.NoError(t, fn(resources.Folder{ID: "child", Path: "parent/child"}, true, nil))
		return true
	})).Return(nil)
	repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		return obj.GetName() == "dash-1"
	}), mock.Anything).Return("parent/child/dash-1.json", nil)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, "start selective resource export").Return()
	progress.On("SetMessage", mock.Anything, "export folders for selected resources").Return()
	progress.On("Record", mock.Anything, mock.Anything).Return()
	progress.On("TooManyErrors").Return(nil)

	options := provisioningV0.ExportJobOptions{
		Branch:    "feature/branch",
		Resources: []provisioningV0.ResourceRef{{Name: "dash-1", Kind: "Dashboard", Group: resources.DashboardResource.Group}},
	}

	err := ExportSpecificResources(context.Background(), options, folderClient, resourceClients, repoResources, progress, false)
	require.NoError(t, err)
}

func TestExportSpecificResources_NonDashboardKindIsExported(t *testing.T) {
	// A supported non-dashboard, non-folder kind (here a Playlist) is resolved
	// against its own kind/group and exported through the shared write path,
	// without the dashboard conversion shim.
	playlistGVK := schema.GroupVersionKind{Group: "playlist.grafana.app", Kind: "Playlist"}
	playlistGVR := schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v0alpha1", Resource: "playlists"}

	playlist := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind":       "Playlist",
			"metadata":   map[string]any{"name": "playlist-1"},
		},
	}
	playlistClient := &mockGetByName{items: map[string]*unstructured.Unstructured{"playlist-1": playlist}}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, playlistGVK).
		Return(playlistClient, playlistGVR, nil)

	repoResources := resources.NewMockRepositoryResources(t)
	repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
		return obj.GetName() == "playlist-1" && obj.GetKind() == "Playlist"
	}), mock.Anything).Return("playlist-1.json", nil)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, "start selective resource export").Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "playlist-1" && r.Action() == repository.FileActionCreated && r.Error() == nil
	})).Return()
	progress.On("TooManyErrors").Return(nil).Once()

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{{Name: "playlist-1", Kind: "Playlist", Group: "playlist.grafana.app"}},
	}

	err := ExportSpecificResources(context.Background(), options, emptyFolderClient(), resourceClients, repoResources, progress, false)
	require.NoError(t, err)
}

func TestExportSpecificResources_UnresolvableKindRecordsError(t *testing.T) {
	// A kind that discovery cannot resolve (e.g. a typo or a disabled resource
	// that slipped past admission) fails the item so the job surfaces the bad
	// input rather than silently dropping it.
	unknownGVK := schema.GroupVersionKind{Group: "unknown.grafana.app", Kind: "Mystery"}

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("ForKind", mock.Anything, unknownGVK).
		Return(nil, schema.GroupVersionResource{}, fmt.Errorf("no clients provider for group unknown.grafana.app"))

	repoResources := resources.NewMockRepositoryResources(t)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, "start selective resource export").Return()
	progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
		return r.Name() == "mystery-1" && r.Action() != repository.FileActionIgnored && r.Error() != nil
	})).Return()
	progress.On("TooManyErrors").Return(nil).Once()

	options := provisioningV0.ExportJobOptions{
		Resources: []provisioningV0.ResourceRef{{Name: "mystery-1", Kind: "Mystery", Group: "unknown.grafana.app"}},
	}

	err := ExportSpecificResources(context.Background(), options, emptyFolderClient(), resourceClients, repoResources, progress, false)
	require.NoError(t, err)
	repoResources.AssertNotCalled(t, "WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything)
}
