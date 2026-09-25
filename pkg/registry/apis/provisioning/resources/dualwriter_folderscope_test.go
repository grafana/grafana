package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// stubAuthorizer satisfies Authorizer by embedding the interface and overriding only the two
// methods createOrUpdate exercises. Any other method would panic (nil embed) if called, which
// keeps the test honest about the write path it covers.
type stubAuthorizer struct{ Authorizer }

func (stubAuthorizer) AuthorizeWrite(context.Context, string) error { return nil }

func (stubAuthorizer) AuthorizeResource(context.Context, *ParsedResource, string) error { return nil }

// TestDualReadWriter_FolderScopeGuard verifies the write path stamps a grafana.app/folder
// annotation onto a resource living in a subdirectory only when the kind is folder-scoped.
// Org-scoped kinds (e.g. playlists) must never get one: their apiserver rejects it with
// "folders are not supported for playlists.playlist.grafana.app". This is the regression the
// FolderScoped gating in createOrUpdate prevents — before it, the dual writer re-stamped a
// folder onto every resource via EnsureFolderPathExist + SetFolder.
func TestDualReadWriter_FolderScopeGuard(t *testing.T) {
	const (
		repoName = "repo"
		subPath  = "team-a/resource.json"
	)

	playlistGVK := schema.GroupVersionKind{Group: "playlist.grafana.app", Version: "v1", Kind: "Playlist"}
	playlistGVR := schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v1", Resource: "playlists"}

	// The folder team-a/ resolves to, pre-seeded into the tree so EnsureFolderPathExist
	// returns it without having to create folders through a client.
	teamAFolder := ParseFolder("team-a/", repoName)

	newParsed := func(t *testing.T, folderScoped bool, client *MockDynamicResourceInterface) *ParsedResource {
		t.Helper()
		obj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "playlist.grafana.app/v1",
			"kind":       "Playlist",
			"metadata":   map[string]any{"name": "res-1", "namespace": "default"},
			"spec":       map[string]any{"title": "Res"},
		}}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetManagerProperties(utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: repoName})

		return &ParsedResource{
			Info:         &repository.FileInfo{Path: subPath},
			Obj:          obj,
			Meta:         meta,
			GVK:          playlistGVK,
			GVR:          playlistGVR,
			Client:       client,
			FolderScoped: folderScoped,
			Repo:         provisioning.ResourceRepositoryInfo{Name: repoName, Namespace: "default"},
			Action:       provisioning.ResourceActionUpdate,
			// Existing + DryRunResponse are pre-set so Run goes straight to the update call
			// (managed by the same repo, so the ownership check passes).
			Existing:       obj.DeepCopy(),
			DryRunResponse: obj.DeepCopy(),
		}
	}

	setup := func(t *testing.T, folderScoped bool) (*DualReadWriter, *ParsedResource, *repository.MockReaderWriter) {
		t.Helper()

		client := &MockDynamicResourceInterface{}
		client.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(&unstructured.Unstructured{}, nil)

		parsed := newParsed(t, folderScoped, client)

		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(newSyncEnabledConfig(repoName))
		rw.On("Update", mock.Anything, subPath, "", mock.Anything, "msg").Return(nil)
		rw.On("Read", mock.Anything, subPath, "").Return(&repository.FileInfo{Path: subPath, Hash: "h"}, nil)

		parser := NewMockParser(t)
		parser.On("Parse", mock.Anything, mock.Anything).Return(parsed, nil)

		tree := NewEmptyFolderTree()
		tree.Add(teamAFolder, "")
		fm := NewFolderManager(rw, nil, tree, FolderKind)

		dw := NewDualReadWriter(rw, parser, fm, stubAuthorizer{}, false)
		return dw, parsed, rw
	}

	t.Run("org-scoped resource is written without a folder annotation", func(t *testing.T) {
		dw, parsed, rw := setup(t, false)

		_, err := dw.UpdateResource(context.Background(), DualWriteOptions{
			Path:       subPath,
			Message:    "msg",
			SkipDryRun: true,
		})
		require.NoError(t, err)
		require.Empty(t, parsed.Meta.GetFolder(),
			"org-scoped resource must not have a folder annotation stamped onto it")
		// The folder resolution must be skipped entirely, so no _folder.json read happens.
		rw.AssertNotCalled(t, "Read", mock.Anything, "team-a/_folder.json", mock.Anything)
	})

	t.Run("folder-scoped resource is written with the resolved folder annotation", func(t *testing.T) {
		dw, parsed, _ := setup(t, true)

		_, err := dw.UpdateResource(context.Background(), DualWriteOptions{
			Path:       subPath,
			Message:    "msg",
			SkipDryRun: true,
		})
		require.NoError(t, err)
		require.Equal(t, teamAFolder.ID, parsed.Meta.GetFolder(),
			"folder-scoped resource must be parented to the resolved subdirectory folder")
	})
}
