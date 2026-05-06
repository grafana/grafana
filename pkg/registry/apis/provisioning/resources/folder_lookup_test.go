package resources

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// TestListerFolderUIDByPath_Lookup verifies the lister-backed implementation
// returns the right folder UID for a source path and falls through cleanly
// when the path is not managed by the repository.
func TestListerFolderUIDByPath_Lookup(t *testing.T) {
	const (
		ns        = "default"
		repoName  = "repo-a"
		folderUID = "bfl5v8qxfilfkb"
	)

	resourceList := &provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			// Folder we expect to find.
			{Group: folders.GROUP, Resource: "folders", Name: folderUID, Path: "team-a/", Title: "Team A"},
			// Folder without a path — must be ignored to avoid a "" key collision.
			{Group: folders.GROUP, Resource: "folders", Name: "no-path", Path: ""},
			// Non-folder resource — must be ignored even if its path coincides.
			{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "shadow", Path: "team-a/"},
		},
	}

	t.Run("returns real UID for trailing-slash path", func(t *testing.T) {
		lister := NewMockResourceLister(t)
		lister.On("List", mock.Anything, ns, repoName).Return(resourceList, nil).Once()

		factory := NewListerFolderUIDByPathFactory(lister)
		lookup := factory.ForRepository(ns, repoName)

		uid, ok, err := lookup.LookupFolderUID(context.Background(), "team-a/")
		require.NoError(t, err)
		assert.True(t, ok)
		assert.Equal(t, folderUID, uid)
	})

	t.Run("normalizes paths missing trailing slash", func(t *testing.T) {
		lister := NewMockResourceLister(t)
		lister.On("List", mock.Anything, ns, repoName).Return(resourceList, nil).Once()

		lookup := NewListerFolderUIDByPathFactory(lister).ForRepository(ns, repoName)

		uid, ok, err := lookup.LookupFolderUID(context.Background(), "team-a")
		require.NoError(t, err)
		assert.True(t, ok)
		assert.Equal(t, folderUID, uid)
	})

	t.Run("returns ok=false for unmanaged path", func(t *testing.T) {
		lister := NewMockResourceLister(t)
		lister.On("List", mock.Anything, ns, repoName).Return(resourceList, nil).Once()

		lookup := NewListerFolderUIDByPathFactory(lister).ForRepository(ns, repoName)

		uid, ok, err := lookup.LookupFolderUID(context.Background(), "team-z/")
		require.NoError(t, err)
		assert.False(t, ok)
		assert.Empty(t, uid)
	})

	t.Run("memoizes the list call", func(t *testing.T) {
		lister := NewMockResourceLister(t)
		lister.On("List", mock.Anything, ns, repoName).Return(resourceList, nil).Once()

		lookup := NewListerFolderUIDByPathFactory(lister).ForRepository(ns, repoName)

		_, _, _ = lookup.LookupFolderUID(context.Background(), "team-a/")
		_, _, _ = lookup.LookupFolderUID(context.Background(), "team-z/")
		_, _, _ = lookup.LookupFolderUID(context.Background(), "team-a")
		// .Once() above is the assertion — multiple calls share a single List.
	})

	t.Run("ignores non-folder items at colliding paths", func(t *testing.T) {
		// The dashboard at "team-a/" must not shadow the folder UID.
		lister := NewMockResourceLister(t)
		lister.On("List", mock.Anything, ns, repoName).Return(resourceList, nil).Once()

		lookup := NewListerFolderUIDByPathFactory(lister).ForRepository(ns, repoName)

		uid, ok, err := lookup.LookupFolderUID(context.Background(), "team-a/")
		require.NoError(t, err)
		assert.True(t, ok)
		assert.Equal(t, folderUID, uid)
	})

	t.Run("propagates lister errors", func(t *testing.T) {
		boom := errors.New("resource index unavailable")
		lister := NewMockResourceLister(t)
		lister.On("List", mock.Anything, ns, repoName).Return(nil, boom).Once()

		lookup := NewListerFolderUIDByPathFactory(lister).ForRepository(ns, repoName)

		_, _, err := lookup.LookupFolderUID(context.Background(), "team-a/")
		require.ErrorIs(t, err, boom)
	})

	t.Run("empty path short-circuits without listing", func(t *testing.T) {
		lister := NewMockResourceLister(t)
		// No call expected.

		lookup := NewListerFolderUIDByPathFactory(lister).ForRepository(ns, repoName)

		uid, ok, err := lookup.LookupFolderUID(context.Background(), "")
		require.NoError(t, err)
		assert.False(t, ok)
		assert.Empty(t, uid)
	})
}

// TestParserFactory_FolderUIDByPathFactory_EndToEnd exercises the full wiring
// from parserFactory through the lister-backed lookup, mirroring the
// production path that handles dashboard saves into UI-created subfolders
// without _folder.json. This is the regression guard for the granular
// folders:uid:<x> 403 bug.
func TestParserFactory_FolderUIDByPathFactory_EndToEnd(t *testing.T) {
	const (
		ns       = "default"
		repoName = "repo-a"
		realUID  = "bfl5v8qxfilfkb"
	)

	cfg := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: repoName},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.LocalRepositoryType,
			Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
		},
	}

	resourceList := &provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{Group: folders.GROUP, Resource: "folders", Name: realUID, Path: "team-a/", Title: "Team A"},
		},
	}

	lister := NewMockResourceLister(t)
	lister.On("List", mock.Anything, ns, repoName).Return(resourceList, nil).Maybe()

	clientFactory := NewMockClientFactory(t)
	clients := NewMockResourceClients(t)
	clients.On("ForKind", mock.Anything, mock.Anything).
		Return(nil, schema.GroupVersionResource{Group: "dashboard.grafana.app", Version: "v0alpha1", Resource: "dashboards"}, nil).Maybe()
	clientFactory.On("Clients", mock.Anything, ns).Return(clients, nil)

	factory := NewParserFactory(clientFactory, false, WithFolderUIDByPathFactory(NewListerFolderUIDByPathFactory(lister)))

	reader := repository.NewMockReaderWriter(t)
	reader.On("Config").Return(cfg).Maybe()

	p, err := factory.GetParser(context.Background(), reader)
	require.NoError(t, err)

	dash, err := p.Parse(context.Background(), &repository.FileInfo{
		Path: "team-a/dash.json",
		Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: dash-in-team-a
spec:
  title: A dashboard
`),
	})
	require.NoError(t, err)
	assert.Equal(t, realUID, dash.Meta.GetFolder(),
		"dashboard saved into a UI-created subfolder must inherit the folder's real UID, not the path-derived hash")
}
