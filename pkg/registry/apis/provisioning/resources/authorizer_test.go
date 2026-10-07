package resources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/dynamic"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// authTestClients returns a ResourceClients exposing the static supported set and
// resolving the static kinds (Dashboard, Folder) to their GVR via ForKind — which is
// what the authorizer consults to map a supported kind to its plural resource.
func authTestClients(t *testing.T) *MockResourceClients {
	c := NewMockResourceClients(t)
	c.EXPECT().SupportedResources().Return(SupportedProvisioningResources).Maybe()
	c.EXPECT().ForKind(mock.Anything, mock.Anything).RunAndReturn(
		func(_ context.Context, gvk schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error) {
			switch gvk.GroupKind() {
			case DashboardKind.GroupKind():
				return nil, DashboardResource, nil
			case FolderKind.GroupKind():
				return nil, FolderResource, nil
			default:
				return nil, schema.GroupVersionResource{}, fmt.Errorf("unexpected kind %v", gvk)
			}
		}).Maybe()
	return c
}

// emptyClients returns a ResourceClients reporting no supported resources. Used by
// ResourcesManager tests that pass a nil FolderManager and only want to exercise the
// write/delete path without entering the folder-annotation branch.
func emptyClients(t *testing.T) *MockResourceClients {
	c := NewMockResourceClients(t)
	c.EXPECT().SupportedResources().Return(nil).Maybe()
	return c
}

func makeAuthorizeResourceParsed(t *testing.T, fileFolderID, existingFolder string, hasExisting bool) *ParsedResource {
	mockMeta := utils.NewMockGrafanaMetaAccessor(t)
	mockMeta.On("GetFolder").Return(fileFolderID)

	parsed := &ParsedResource{
		Obj: &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "test-dashboard",
				},
			},
		},
		Meta: mockMeta,
		GVR: schema.GroupVersionResource{
			Group:    "dashboard.grafana.app",
			Resource: "dashboards",
		},
	}

	if hasExisting {
		parsed.Existing = &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "test-dashboard",
					"annotations": map[string]interface{}{
						"grafana.app/folder": existingFolder,
					},
				},
			},
		}
	}

	return parsed
}

// TestAuthorizeResource tests authorization checks for resource operations.
func TestAuthorizeResource(t *testing.T) {
	repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test-repo"}}

	t.Run("new resource uses destination folder only", func(t *testing.T) {
		parsed := makeAuthorizeResourceParsed(t, "dest-folder", "", false)
		mockAccess := auth.NewMockAccessChecker(t)
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbCreate
		}), "dest-folder").Return(nil).Once()

		err := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false).AuthorizeResource(context.Background(), parsed, utils.VerbCreate)
		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("same-folder update runs single check", func(t *testing.T) {
		parsed := makeAuthorizeResourceParsed(t, "folder-a", "folder-a", true)
		mockAccess := auth.NewMockAccessChecker(t)
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), "folder-a").Return(nil).Once()

		err := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false).AuthorizeResource(context.Background(), parsed, utils.VerbUpdate)
		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("cross-folder move checks both source and destination", func(t *testing.T) {
		parsed := makeAuthorizeResourceParsed(t, "folder-b", "folder-a", true)
		mockAccess := auth.NewMockAccessChecker(t)
		// source check
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), "folder-a").Return(nil).Once()
		// destination check
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), "folder-b").Return(nil).Once()

		err := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false).AuthorizeResource(context.Background(), parsed, utils.VerbUpdate)
		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("cross-folder move denied when destination is inaccessible", func(t *testing.T) {
		parsed := makeAuthorizeResourceParsed(t, "restricted-folder", "allowed-folder", true)
		mockAccess := auth.NewMockAccessChecker(t)
		// source check passes
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), "allowed-folder").Return(nil).Once()
		// destination check fails
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), "restricted-folder").Return(assert.AnError).Once()

		err := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false).AuthorizeResource(context.Background(), parsed, utils.VerbUpdate)
		assert.Error(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("cross-folder move denied when source is inaccessible", func(t *testing.T) {
		parsed := makeAuthorizeResourceParsed(t, "dest-folder", "restricted-folder", true)
		mockAccess := auth.NewMockAccessChecker(t)
		// source check fails — destination check never runs
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), "restricted-folder").Return(assert.AnError).Once()

		err := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false).AuthorizeResource(context.Background(), parsed, utils.VerbUpdate)
		assert.Error(t, err)
		mockAccess.AssertExpectations(t)
	})
}

func TestAuthorizeResourcePreview_ExistingAncestor(t *testing.T) {
	for _, gvr := range []schema.GroupVersionResource{
		DashboardResource,
		DashboardResourceV2beta1,
		dashboard.LibraryPanelResourceInfo.GroupVersionResource(),
		{Group: "example.grafana.app", Version: "v1alpha1", Resource: "widgets"},
	} {
		t.Run(gvr.Resource+"/"+gvr.Version, func(t *testing.T) {
			states := []string{"new", "moved", "same-folder"}
			for _, state := range states {
				t.Run(state, func(t *testing.T) {
					testAuthorizeResourceReadExistingAncestor(t, gvr, state)
				})
			}
		})
	}
}

func makeAuthorizeResourceReadParsed(t *testing.T, gvr schema.GroupVersionResource, state, destination, path string) (*ParsedResource, string) {
	t.Helper()
	sourceFolder := "source-folder"
	if state == "same-folder" {
		sourceFolder = destination
	}
	parsed := makeAuthorizeResourceParsed(t, destination, sourceFolder, state != "new")
	parsed.Obj.SetName("test-resource")
	if parsed.Existing != nil {
		parsed.Existing.SetName("existing-resource")
	}
	parsed.FolderScoped = true
	parsed.GVR = gvr
	parsed.Info = &repository.FileInfo{Path: path, Ref: "feature-branch"}
	if parsed.Info.Path == "" {
		parsed.Info.Path = "team/new/resource.json"
	}
	return parsed, sourceFolder
}

func expectConfiguredAncestorMetadata(t *testing.T, reader *repository.MockReaderWriter, caller *identity.StaticRequester, data []byte, readErr error) {
	t.Helper()
	reader.EXPECT().Read(mock.Anything, mock.Anything, "").RunAndReturn(func(readCtx context.Context, path, _ string) (*repository.FileInfo, error) {
		id, err := identity.GetRequester(readCtx)
		require.NoError(t, err)
		require.Same(t, caller, id)
		if path == "team/new/_folder.json" {
			if readErr != nil {
				return nil, readErr
			}
			if data != nil {
				return &repository.FileInfo{Path: path, Data: data}, nil
			}
		}
		return nil, repository.ErrFileNotFound
	}).Maybe()
}

func testAuthorizeResourceReadExistingAncestor(t *testing.T, gvr schema.GroupVersionResource, state string) {
	t.Helper()
	const repoName = "preview-repo"
	teamID := ParseFolder("team/", repoName).ID
	newID := ParseFolder("team/new/", repoName).ID
	deepID := ParseFolder("team/new/deep/", repoName).ID
	ancestorPaths := map[string]string{
		teamID: "team/", newID: "team/new/", deepID: "team/new/deep/",
		repoName: "", "configured-folder": "team/new/",
	}
	denied := apierrors.NewForbidden(gvr.GroupResource(), "test-resource", errors.New("no read permission"))
	accessErr := errors.New("authorization service unavailable")
	forbiddenAccessErr := apierrors.NewForbidden(gvr.GroupResource(), "test-resource", accessErr)
	lookupErr := errors.New("folder lookup failed")
	readErr := errors.New("repository unavailable")
	metadata, err := json.Marshal(NewFolderManifest("configured-folder", "New", FolderKind))
	require.NoError(t, err)

	tests := []struct {
		name            string
		path            string
		destination     string
		target          provisioning.SyncTargetType
		metadataEnabled bool
		metadata        []byte
		metadataErr     error
		existing        []string
		allowed         string
		alsoAllowed     string
		accessErrorID   string
		accessErr       error
		lookupErrorID   string
		wantProbes      []string
		wantChecks      []string
		wantErr         error
		wantForbidden   bool
	}{
		{
			name: "inherits from the nearest existing parent", existing: []string{teamID}, allowed: teamID,
			wantProbes: []string{newID, teamID}, wantChecks: []string{teamID},
		},
		{
			name: "skips several missing folders", path: "team/new/deep/resource.json", destination: deepID,
			existing: []string{teamID}, allowed: teamID,
			wantProbes: []string{deepID, newID, teamID}, wantChecks: []string{teamID},
		},
		{
			name: "inherits from the existing repository root", existing: []string{repoName}, allowed: repoName,
			wantProbes: []string{newID, teamID, repoName}, wantChecks: []string{repoName},
		},
		{
			name: "denied nearest ancestor stops before an allowed root", existing: []string{teamID, repoName}, allowed: repoName,
			wantProbes: []string{newID, teamID}, wantChecks: []string{teamID}, wantErr: denied,
		},
		{
			name: "existing destination denial is authoritative", existing: []string{newID, teamID}, allowed: teamID,
			wantProbes: []string{newID}, wantChecks: []string{newID}, wantErr: denied,
		},
		{
			name: "malformed configured metadata precedes destination permission", existing: []string{newID},
			metadataEnabled: true, metadata: []byte("{invalid"),
			wantErr: ErrInvalidFolderMetadata,
		},
		{
			name: "existing destination access error stops before an allowed ancestor", existing: []string{newID, teamID}, allowed: teamID,
			accessErrorID: newID, accessErr: accessErr,
			wantProbes: []string{newID}, wantChecks: []string{newID}, wantErr: accessErr,
		},
		{
			name: "existing destination forbidden-wrapped access error stops before an allowed ancestor", existing: []string{newID, teamID}, allowed: teamID,
			accessErrorID: newID, accessErr: forbiddenAccessErr,
			wantProbes: []string{newID}, wantChecks: []string{newID}, wantErr: forbiddenAccessErr,
		},
		{
			name: "nearest ancestor access error stops before an allowed root", existing: []string{teamID, repoName}, allowed: repoName,
			accessErrorID: teamID, accessErr: accessErr,
			wantProbes: []string{newID, teamID}, wantChecks: []string{teamID}, wantErr: accessErr,
		},
		{
			name: "nearest ancestor forbidden-wrapped access error stops before an allowed root", existing: []string{teamID, repoName}, allowed: repoName,
			accessErrorID: teamID, accessErr: forbiddenAccessErr,
			wantProbes: []string{newID, teamID}, wantChecks: []string{teamID}, wantErr: forbiddenAccessErr,
		},
		{
			name: "PR UID cannot bypass the configured directory", destination: "pr-controlled-uid",
			metadataEnabled: true, metadata: metadata, existing: []string{"configured-folder", teamID}, allowed: teamID,
			wantProbes: []string{"configured-folder"},
			wantChecks: []string{"configured-folder"}, wantErr: denied,
		},
		{
			name: "allowed PR UID cannot bypass the configured directory", destination: "pr-controlled-uid",
			metadataEnabled: true, metadata: metadata, existing: []string{"pr-controlled-uid", "configured-folder"}, allowed: "pr-controlled-uid",
			wantProbes: []string{"configured-folder"},
			wantChecks: []string{"configured-folder"}, wantErr: denied,
		},
		{
			name: "configured directory is authoritative even when PR UID is inaccessible", destination: "pr-controlled-uid",
			metadataEnabled: true, metadata: metadata, existing: []string{"pr-controlled-uid", "configured-folder"}, allowed: "configured-folder",
			wantProbes: []string{"configured-folder"}, wantChecks: []string{"configured-folder"},
		},
		{
			name: "configured folder UID authorizes the immediate directory", destination: "pr-controlled-uid",
			metadataEnabled: true, metadata: metadata, existing: []string{"configured-folder"}, allowed: "configured-folder",
			wantProbes: []string{"configured-folder"}, wantChecks: []string{"configured-folder"},
		},
		{
			name: "matching configured UID preserves allowed check", destination: "configured-folder",
			metadataEnabled: true, metadata: metadata, existing: []string{"configured-folder"}, allowed: "configured-folder",
			wantProbes: []string{"configured-folder"}, wantChecks: []string{"configured-folder"},
		},
		{
			name: "matching hash UID preserves allowed check", existing: []string{newID}, allowed: newID,
			wantProbes: []string{newID}, wantChecks: []string{newID},
		},
		{
			name: "metadata enabled falls back to hash IDs for missing manifests", metadataEnabled: true,
			existing: []string{teamID}, allowed: teamID, wantProbes: []string{newID, teamID}, wantChecks: []string{teamID},
		},
		{
			name: "missing repository root is forbidden without an access check", allowed: repoName,
			wantProbes: []string{newID, teamID, repoName}, wantForbidden: true,
		},
		{
			name: "instance repository can use a real ancestor", target: provisioning.SyncTargetTypeInstance,
			existing: []string{teamID}, allowed: teamID, wantProbes: []string{newID, teamID}, wantChecks: []string{teamID},
		},
		{
			name: "instance ancestor denial prevents root fallback", target: provisioning.SyncTargetTypeInstance,
			existing: []string{teamID}, wantProbes: []string{newID, teamID}, wantChecks: []string{teamID}, wantErr: denied,
		},
		{
			name: "instance ancestor access error prevents root fallback", target: provisioning.SyncTargetTypeInstance,
			existing: []string{teamID}, accessErrorID: teamID, accessErr: accessErr,
			wantProbes: []string{newID, teamID}, wantChecks: []string{teamID}, wantErr: accessErr,
		},
		{
			name: "instance lookup error prevents root fallback", target: provisioning.SyncTargetTypeInstance,
			lookupErrorID: teamID, wantProbes: []string{newID, teamID}, wantErr: lookupErr,
		},
		{
			name: "instance metadata error prevents root fallback", target: provisioning.SyncTargetTypeInstance,
			metadataEnabled: true, metadataErr: readErr, wantErr: readErr,
		},
		{
			name: "instance malformed metadata prevents root fallback", target: provisioning.SyncTargetTypeInstance,
			metadataEnabled: true, metadata: []byte("{invalid"), wantErr: ErrInvalidFolderMetadata,
		},
		{
			name: "folderless repository uses a real ancestor", target: provisioning.SyncTargetTypeFolderless,
			existing: []string{teamID}, allowed: teamID, wantProbes: []string{newID, teamID}, wantChecks: []string{teamID},
		},
		{
			name: "folderless ancestor denial prevents root fallback", target: provisioning.SyncTargetTypeFolderless,
			existing: []string{teamID}, wantProbes: []string{newID, teamID}, wantChecks: []string{teamID}, wantErr: denied,
		},
		{
			name: "folderless ancestor access error prevents root fallback", target: provisioning.SyncTargetTypeFolderless,
			existing: []string{teamID}, accessErrorID: teamID, accessErr: accessErr,
			wantProbes: []string{newID, teamID}, wantChecks: []string{teamID}, wantErr: accessErr,
		},
		{
			name: "folderless lookup error prevents root fallback", target: provisioning.SyncTargetTypeFolderless,
			lookupErrorID: teamID, wantProbes: []string{newID, teamID}, wantErr: lookupErr,
		},
		{
			name: "folderless metadata error prevents root fallback", target: provisioning.SyncTargetTypeFolderless,
			metadataEnabled: true, metadataErr: readErr, wantErr: readErr,
		},
		{
			name: "folderless malformed metadata prevents root fallback", target: provisioning.SyncTargetTypeFolderless,
			metadataEnabled: true, metadata: []byte("{invalid"), wantErr: ErrInvalidFolderMetadata,
		},
		{
			name: "grant on missing destination is skipped for an allowed ancestor", existing: []string{teamID},
			allowed: newID, alsoAllowed: teamID, wantProbes: []string{newID, teamID}, wantChecks: []string{teamID},
		},
		{
			name: "grant on missing destination cannot bypass ancestor permission", existing: []string{teamID}, allowed: newID,
			wantProbes: []string{newID, teamID}, wantChecks: []string{teamID}, wantErr: denied,
		},
		{
			name: "allowed missing destination cannot authorize a missing repository root", allowed: newID,
			wantProbes: []string{newID, teamID, repoName}, wantForbidden: true,
		},
		{
			name: "allowed missing configured UID still requires an ancestor", destination: "configured-folder",
			metadataEnabled: true, metadata: metadata, allowed: "configured-folder",
			wantProbes: []string{"configured-folder", teamID, repoName}, wantForbidden: true,
		},
		{
			name: "allowed missing repository root is denied", path: "resource.json", destination: repoName, allowed: repoName,
			wantProbes: []string{repoName}, wantForbidden: true,
		},
		{
			name: "allowed PR UID cannot authorize a missing repository root", destination: "pr-controlled-uid", allowed: "pr-controlled-uid",
			existing: []string{"pr-controlled-uid"}, wantProbes: []string{newID, teamID, repoName},
			wantForbidden: true,
		},
		{
			name: "destination lookup errors propagate", lookupErrorID: newID,
			wantProbes: []string{newID}, wantErr: lookupErr,
		},
		{
			name: "ancestor lookup errors propagate", lookupErrorID: teamID,
			wantProbes: []string{newID, teamID}, wantErr: lookupErr,
		},
		{
			name: "allowed destination lookup errors propagate", allowed: newID, lookupErrorID: newID,
			wantProbes: []string{newID}, wantErr: lookupErr,
		},
		{
			name: "metadata lookup errors propagate", metadataEnabled: true, metadataErr: readErr,
			wantErr: readErr,
		},
		{
			name: "allowed destination still propagates metadata lookup errors", existing: []string{newID}, allowed: newID,
			metadataEnabled: true, metadataErr: readErr,
			wantErr: readErr,
		},
		{
			name: "allowed destination cannot bypass malformed configured metadata", existing: []string{newID}, allowed: newID,
			metadataEnabled: true, metadata: []byte("{invalid"),
			wantErr: ErrInvalidFolderMetadata,
		},
		{
			name: "malformed configured metadata prevents fallback", metadataEnabled: true, metadata: []byte("{invalid"),
			wantErr: ErrInvalidFolderMetadata,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			metadataEnabled := tt.metadataEnabled
			cfg := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: repoName, Namespace: "stacks-123"}}
			cfg.Spec.Sync.Target = tt.target
			if cfg.Spec.Sync.Target == "" {
				cfg.Spec.Sync.Target = provisioning.SyncTargetTypeFolder
			}
			caller := &identity.StaticRequester{Type: authlib.TypeUser, UserID: 42, Namespace: cfg.Namespace}
			ctx := identity.WithRequester(context.Background(), caller)
			destination := tt.destination
			if destination == "" {
				destination = newID
			}
			parsed, sourceFolder := makeAuthorizeResourceReadParsed(t, gvr, state, destination, tt.path)
			hasExisting := state != "new"
			resourceName := parsed.Obj.GetName()
			if hasExisting {
				resourceName = parsed.Existing.GetName()
			}
			original := parsed.Obj.DeepCopy()
			var existingOriginal *unstructured.Unstructured
			if hasExisting {
				existingOriginal = parsed.Existing.DeepCopy()
			}
			reader := repository.NewMockReaderWriter(t)
			reader.On("Config").Return(cfg).Maybe()
			if metadataEnabled {
				expectConfiguredAncestorMetadata(t, reader, caller, tt.metadata, tt.metadataErr)
			}
			var probes, checks []string
			folderClient := &MockDynamicResourceInterface{}
			folderClient.Test(t)
			t.Cleanup(func() { folderClient.AssertExpectations(t) })
			isProvisioning := mock.MatchedBy(func(ctx context.Context) bool {
				id, err := identity.GetRequester(ctx)
				return err == nil && identity.IsProvisioningServiceIdentity(id) && id.GetNamespace() == cfg.Namespace
			})
			for _, id := range tt.wantProbes {
				var obj *unstructured.Unstructured
				var getErr error = apierrors.NewNotFound(FolderResource.GroupResource(), id)
				for _, existingID := range tt.existing {
					if existingID == id {
						obj = newManagedAncestorFolder(t, cfg, id, ancestorPaths[id])
						getErr = nil
					}
				}
				if id == tt.lookupErrorID {
					getErr = lookupErr
				}
				folderClient.On("Get", isProvisioning, id, metav1.GetOptions{}, []string(nil)).Return(obj, getErr).
					Run(func(args mock.Arguments) { probes = append(probes, args.String(1)) }).Once()
			}
			clients := NewMockResourceClients(t)
			access := auth.NewMockAccessChecker(t)
			wantChecks := tt.wantChecks
			checkSource := hasExisting && sourceFolder != destination
			checkResolvedSource := state == "same-folder" && len(tt.wantChecks) > 0 && sourceFolder != tt.wantChecks[0]
			if checkSource || checkResolvedSource {
				wantChecks = append([]string{sourceFolder}, wantChecks...)
				access.On("Check", ctx, authlib.CheckRequest{
					Group: parsed.GVR.Group, Resource: parsed.GVR.Resource, Name: resourceName, Verb: utils.VerbGet,
				}, sourceFolder).Return(nil).Run(func(mock.Arguments) {
					if checkSource {
						assert.Empty(t, probes, "moved source access must precede destination lookup")
					} else {
						assert.Equal(t, tt.wantProbes, probes, "unchanged source is rechecked after resolving a different ancestor")
					}
					checks = append(checks, sourceFolder)
				}).Once()
			}
			for _, id := range tt.wantChecks {
				var accessErr error = denied
				if id == tt.allowed || id == tt.alsoAllowed {
					accessErr = nil
				}
				if id == tt.accessErrorID {
					accessErr = tt.accessErr
				}
				access.On("Check", ctx, authlib.CheckRequest{
					Group: parsed.GVR.Group, Resource: parsed.GVR.Resource, Name: resourceName, Verb: utils.VerbGet,
				}, id).Return(accessErr).Run(func(args mock.Arguments) {
					assert.Contains(t, probes, args.String(2), "permission checks must follow a successful existence lookup")
					assert.Contains(t, tt.existing, args.String(2), "permission checks must only target existing folders")
					checks = append(checks, args.String(2))
					id, err := identity.GetRequester(args.Get(0).(context.Context))
					require.NoError(t, err)
					require.Same(t, caller, id)
				}).Once()
			}

			folders := NewFolderManager(reader, folderClient, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(metadataEnabled))
			err := NewAuthorizer(cfg, reader, access, clients, folders, metadataEnabled).AuthorizeResourcePreview(ctx, parsed)
			if tt.wantForbidden {
				require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
			} else if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, tt.wantProbes, probes)
			assert.Equal(t, wantChecks, checks)
			assert.Equal(t, original, parsed.Obj)
			if hasExisting {
				assert.Equal(t, existingOriginal, parsed.Existing)
			}
			assert.Equal(t, destination, parsed.Meta.GetFolder())
		})
	}
}

func TestAuthorizeResourcePreview_UsesRoot(t *testing.T) {
	for _, target := range []provisioning.SyncTargetType{provisioning.SyncTargetTypeInstance, provisioning.SyncTargetTypeFolderless} {
		t.Run(string(target), func(t *testing.T) {
			testAuthorizeResourceReadUsesRoot(t, target)
		})
	}
}

func testAuthorizeResourceReadUsesRoot(t *testing.T, target provisioning.SyncTargetType) {
	t.Helper()
	for _, gvr := range []schema.GroupVersionResource{
		DashboardResource,
		{Group: "example.grafana.app", Version: "v1alpha1", Resource: "widgets"},
	} {
		t.Run(gvr.Resource, func(t *testing.T) {
			for _, tt := range []struct {
				name        string
				state       string
				destination string
				denySource  bool
				denyRoot    bool
			}{
				{name: "new resource root allowed", state: "new"},
				{name: "new resource root denied", state: "new", denyRoot: true},
				{name: "allowed PR UID still requires root permission", state: "new", destination: "pr-controlled-uid", denyRoot: true},
				{name: "moved resource root allowed", state: "moved"},
				{name: "moved resource root denied", state: "moved", denyRoot: true},
				{name: "moved resource source denied", state: "moved", denySource: true},
				{name: "matching metadata root allowed", state: "same-folder"},
				{name: "matching metadata root denied", state: "same-folder", denyRoot: true},
				{name: "matching metadata source denied", state: "same-folder", denySource: true},
			} {
				t.Run(tt.name, func(t *testing.T) {
					cfg := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "preview-repo", Namespace: "default"}}
					cfg.Spec.Sync.Target = target
					caller := &identity.StaticRequester{Type: authlib.TypeUser, UserID: 42, Namespace: cfg.Namespace}
					ctx := identity.WithRequester(context.Background(), caller)
					destination := tt.destination
					if destination == "" {
						destination = ParseFolder("team/new/", cfg.Name).ID
					}
					parsed, source := makeAuthorizeResourceReadParsed(t, gvr, tt.state, destination, "team/new/resource.json")
					name := parsed.Obj.GetName()
					if parsed.Existing != nil {
						name = parsed.Existing.GetName()
					}
					req := authlib.CheckRequest{Group: gvr.Group, Resource: gvr.Resource, Name: name, Verb: utils.VerbGet}
					denied := apierrors.NewForbidden(gvr.GroupResource(), name, errors.New("no read permission"))
					reader := repository.NewMockReader(t)
					folders := NewMockFolderAncestorFinder(t)
					lookupCompleted := false
					wantLookup := tt.state != "moved" || !tt.denySource
					if wantLookup {
						folders.EXPECT().FindExistingAncestor(ctx, "team/new/", "").Return("", false, nil).
							Run(func(context.Context, string, string) { lookupCompleted = true }).Once()
					}
					access := auth.NewMockAccessChecker(t)
					if parsed.Existing == nil {
						access.On("Check", ctx, req, destination).Return(nil).Maybe()
					}
					if parsed.Existing != nil {
						var sourceErr error
						if tt.denySource {
							sourceErr = denied
						}
						access.On("Check", ctx, req, source).Return(sourceErr).Run(func(mock.Arguments) {
							if tt.state == "moved" {
								assert.False(t, lookupCompleted, "moved source must be authorized before ancestor lookup")
							} else {
								assert.True(t, lookupCompleted, "matching metadata must retain the source check after ancestor lookup")
							}
						}).Once()
					}
					if !tt.denySource {
						var rootErr error
						if tt.denyRoot {
							rootErr = denied
						}
						access.On("Check", ctx, req, "").Return(rootErr).Run(func(mock.Arguments) {
							assert.True(t, lookupCompleted, "root access must follow the complete ancestor lookup")
						}).Once()
					}

					err := NewAuthorizer(cfg, reader, access, NewMockResourceClients(t), folders, true).AuthorizeResourcePreview(ctx, parsed)
					if tt.denySource || tt.denyRoot {
						require.ErrorIs(t, err, denied)
					} else {
						require.NoError(t, err)
					}
					assert.Equal(t, wantLookup, lookupCompleted)
					if parsed.Existing == nil {
						access.AssertNotCalled(t, "Check", ctx, req, destination)
					}
				})
			}
		})
	}
}

func TestAuthorizeResourcePreview_SkipsUnrelatedAncestors(t *testing.T) {
	cfg := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "preview-repo", Namespace: "default"}}
	cfg.Spec.Sync.Target = provisioning.SyncTargetTypeFolder
	manager := utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: cfg.Name}
	otherRepo := utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "other-repo"}
	for _, gvr := range []schema.GroupVersionResource{DashboardResource, dashboard.LibraryPanelResourceInfo.GroupVersionResource()} {
		t.Run(gvr.Resource, func(t *testing.T) {
			for _, tt := range []struct {
				name            string
				manager         utils.ManagerProperties
				sourcePath      string
				root            bool
				target          provisioning.SyncTargetType
				skipParent      bool
				missingRoot     bool
				canReadAncestor bool
			}{
				{name: "unmanaged folder", sourcePath: "team/new/"},
				{name: "different manager kind", manager: utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: cfg.Name}, sourcePath: "team/new/"},
				{name: "different repository", manager: otherRepo, sourcePath: "team/new/"},
				{name: "different source path", manager: manager, sourcePath: "elsewhere/"},
				{name: "missing source path", manager: manager},
				{name: "unmanaged folder with parent access", sourcePath: "team/new/", canReadAncestor: true},
				{name: "different repository with parent access", manager: otherRepo, sourcePath: "team/new/", canReadAncestor: true},
				{name: "different source path with parent access", manager: manager, sourcePath: "elsewhere/", canReadAncestor: true},
				{name: "multiple mismatches without root access", manager: otherRepo, sourcePath: "team/new/", skipParent: true},
				{name: "multiple mismatches with root access", manager: otherRepo, sourcePath: "team/new/", skipParent: true, canReadAncestor: true},
				{name: "multiple mismatches with missing root", manager: otherRepo, sourcePath: "team/new/", skipParent: true, missingRoot: true, canReadAncestor: true},
				{name: "unmanaged root", root: true},
				{name: "different repository root", manager: otherRepo, root: true},
				{name: "mislocated root", manager: manager, sourcePath: "team/", root: true},
				{name: "folderless unmanaged folder", sourcePath: "team/new/", target: provisioning.SyncTargetTypeFolderless},
				{name: "folderless different repository", manager: otherRepo, sourcePath: "team/new/", target: provisioning.SyncTargetTypeFolderless},
				{name: "folderless different source path", manager: manager, sourcePath: "elsewhere/", target: provisioning.SyncTargetTypeFolderless},
				{name: "instance unmanaged folder", sourcePath: "team/new/", target: provisioning.SyncTargetTypeInstance},
				{name: "instance different repository", manager: otherRepo, sourcePath: "team/new/", target: provisioning.SyncTargetTypeInstance},
				{name: "instance different source path", manager: manager, sourcePath: "elsewhere/", target: provisioning.SyncTargetTypeInstance},
				{name: "folderless unmanaged folder with parent access", sourcePath: "team/new/", target: provisioning.SyncTargetTypeFolderless, canReadAncestor: true},
				{name: "instance unmanaged folder with parent access", sourcePath: "team/new/", target: provisioning.SyncTargetTypeInstance, canReadAncestor: true},
				{name: "folderless mismatches without root access", sourcePath: "team/new/", target: provisioning.SyncTargetTypeFolderless, skipParent: true},
				{name: "instance mismatches without root access", sourcePath: "team/new/", target: provisioning.SyncTargetTypeInstance, skipParent: true},
				{name: "folderless mismatches with root access", sourcePath: "team/new/", target: provisioning.SyncTargetTypeFolderless, skipParent: true, canReadAncestor: true},
				{name: "instance mismatches with root access", sourcePath: "team/new/", target: provisioning.SyncTargetTypeInstance, skipParent: true, canReadAncestor: true},
			} {
				t.Run(tt.name, func(t *testing.T) {
					cfg := cfg.DeepCopy()
					if tt.target != "" {
						cfg.Spec.Sync.Target = tt.target
					}
					caller := &identity.StaticRequester{
						Type: authlib.TypeUser, UserID: 42, Namespace: cfg.Namespace,
					}
					ctx := identity.WithRequester(context.Background(), caller)
					decoyID, path := "configured-folder", "team/new/resource.json"
					if tt.root {
						decoyID, path = cfg.Name, "resource.json"
					}
					parsed, _ := makeAuthorizeResourceReadParsed(t, gvr, "new", decoyID, path)
					reader := repository.NewMockReaderWriter(t)
					reader.EXPECT().Config().Return(cfg).Maybe()
					manifest, err := json.Marshal(NewFolderManifest(decoyID, "New", FolderKind))
					require.NoError(t, err)
					expectConfiguredAncestorMetadata(t, reader, caller, manifest, nil)
					decoy := newManagedAncestorFolder(t, cfg, decoyID, tt.sourcePath)
					meta, err := utils.MetaAccessor(decoy)
					require.NoError(t, err)
					meta.SetManagerProperties(tt.manager)
					folderClient := &MockDynamicResourceInterface{}
					folderClient.Test(t)
					t.Cleanup(func() { folderClient.AssertExpectations(t) })
					var probes []string
					folderClient.On("Get", mock.Anything, decoyID, metav1.GetOptions{}, []string(nil)).Return(decoy, nil).
						Run(func(args mock.Arguments) { probes = append(probes, args.String(1)) }).Once()
					wantProbes := []string{decoyID}
					canAuthorize := !tt.root
					var authorizationFolder string
					if !tt.root {
						parentID := ParseFolder("team/", cfg.Name).ID
						parentPath := "team/"
						if tt.skipParent {
							parentPath = "elsewhere/"
						}
						folderClient.On("Get", mock.Anything, parentID, metav1.GetOptions{}, []string(nil)).
							Return(newManagedAncestorFolder(t, cfg, parentID, parentPath), nil).
							Run(func(args mock.Arguments) { probes = append(probes, args.String(1)) }).Once()
						wantProbes = append(wantProbes, parentID)
						authorizationFolder = parentID
						if tt.skipParent {
							authorizationFolder = RootFolder(cfg)
							if authorizationFolder != "" {
								var root *unstructured.Unstructured
								var rootErr error
								if tt.missingRoot {
									canAuthorize = false
									rootErr = apierrors.NewNotFound(FolderResource.GroupResource(), authorizationFolder)
								} else {
									root = newManagedAncestorFolder(t, cfg, authorizationFolder, "")
								}
								folderClient.On("Get", mock.Anything, authorizationFolder, metav1.GetOptions{}, []string(nil)).
									Return(root, rootErr).
									Run(func(args mock.Arguments) { probes = append(probes, args.String(1)) }).Once()
								wantProbes = append(wantProbes, authorizationFolder)
							}
						}
					}
					access := auth.NewMockAccessChecker(t)
					if canAuthorize {
						var accessErr error
						if !tt.canReadAncestor {
							accessErr = apierrors.NewForbidden(gvr.GroupResource(), parsed.Obj.GetName(), errors.New("no ancestor read permission"))
						}
						access.On("Check", ctx, authlib.CheckRequest{
							Group: gvr.Group, Resource: gvr.Resource, Name: parsed.Obj.GetName(), Verb: utils.VerbGet,
						}, authorizationFolder).Return(accessErr).Once()
					}
					folders := NewFolderManager(reader, folderClient, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))

					err = NewAuthorizer(cfg, reader, access, NewMockResourceClients(t), folders, true).AuthorizeResourcePreview(ctx, parsed)
					if canAuthorize && tt.canReadAncestor {
						require.NoError(t, err)
					} else {
						require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
					}
					assert.Equal(t, wantProbes, probes, "lookup must skip unrelated folders and stop at the nearest matching ancestor")
					access.AssertNotCalled(t, "Check", mock.Anything, mock.Anything, decoyID)
					if !canAuthorize {
						access.AssertNotCalled(t, "Check", mock.Anything, mock.Anything, mock.Anything)
					}
				})
			}
		})
	}
}

func TestAuthorizeResource_DirectAuthorization(t *testing.T) {
	for _, gvr := range []schema.GroupVersionResource{
		DashboardResource,
		dashboard.LibraryPanelResourceInfo.GroupVersionResource(),
		FolderResource,
		{Group: "example.grafana.app", Version: "v1alpha1", Resource: "widgets"},
	} {
		t.Run(gvr.Resource, func(t *testing.T) {
			testResourceDirectAuthorization(t, gvr)
		})
	}
}

func TestAuthorizeResource_FolderReadsUseDirectAuthorization(t *testing.T) {
	for _, tt := range []struct {
		name           string
		path           string
		parent         string
		existingParent string
		existing       bool
	}{
		{name: "new nested folder", path: "team/new/_folder.json", parent: "team"},
		{name: "new top-level folder", path: "new/_folder.json"},
		{name: "existing nested folder", path: "team/existing/_folder.json", parent: "team", existingParent: "team", existing: true},
		{name: "existing top-level folder", path: "existing/_folder.json", existing: true},
		{name: "moved folder", path: "team/moved/_folder.json", parent: "team", existingParent: "source", existing: true},
		{name: "folder moved to root", path: "moved/_folder.json", existingParent: "source", existing: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			checkedParents := []string{tt.parent}
			if tt.existing && tt.existingParent != tt.parent {
				checkedParents = append([]string{tt.existingParent}, checkedParents...)
			}
			for denyAt := -1; denyAt < len(checkedParents); denyAt++ {
				t.Run(fmt.Sprintf("deny check %d", denyAt), func(t *testing.T) {
					cfg := &provisioning.Repository{Spec: provisioning.RepositorySpec{
						Type: provisioning.GitRepositoryType, Git: &provisioning.GitRepositoryConfig{Branch: "main"},
					}}
					parsed := makeAuthorizeResourceParsed(t, tt.parent, tt.existingParent, tt.existing)
					parsed.GVR = FolderResource
					parsed.FolderScoped = true
					parsed.Info = &repository.FileInfo{Path: tt.path, Ref: "feature"}
					parsed.Obj.SetName("proposed-folder")
					name := parsed.Obj.GetName()
					if parsed.Existing != nil {
						parsed.Existing.SetName("existing-folder")
						name = parsed.Existing.GetName()
					}
					req := authlib.CheckRequest{Group: FolderResource.Group, Resource: FolderResource.Resource, Name: name, Verb: utils.VerbGet}
					denied := apierrors.NewForbidden(FolderResource.GroupResource(), name, errors.New("no read permission"))
					access := auth.NewMockAccessChecker(t)
					var wantErr error
					var previous *mock.Call
					for i, parent := range checkedParents {
						if i == denyAt {
							wantErr = denied
						}
						call := access.On("Check", t.Context(), req, parent).Return(wantErr).Once()
						if previous != nil {
							call.NotBefore(previous)
						}
						previous = call
						if wantErr != nil {
							break
						}
					}
					reader := repository.NewMockReaderWriter(t)
					authorizer := NewAuthorizer(cfg, reader, access, NewMockResourceClients(t), nil, true)

					err := authorizer.AuthorizeResource(t.Context(), parsed, utils.VerbGet)
					require.ErrorIs(t, err, wantErr)
					require.Equal(t, tt.parent, parsed.Meta.GetFolder())
				})
			}
		})
	}
}

func TestAuthorizeResourcePreview_PanicsWithoutFolderManager(t *testing.T) {
	for _, tt := range []struct {
		name           string
		existingFolder string
	}{
		{name: "new resource"},
		{name: "moved resource", existingFolder: "source-folder"},
		{name: "same-folder existing resource", existingFolder: "destination-folder"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "preview-repo", Namespace: "default"}}
			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				Type: authlib.TypeUser, UserID: 42, Namespace: cfg.Namespace,
			})
			parsed := makeAuthorizeResourceParsed(t, "destination-folder", tt.existingFolder, tt.existingFolder != "")
			parsed.FolderScoped = true
			parsed.Info = &repository.FileInfo{Path: "team/new/resource.json", Ref: "feature"}
			access := auth.NewMockAccessChecker(t)
			if tt.existingFolder != "" && tt.existingFolder != parsed.Meta.GetFolder() {
				access.On("Check", ctx, authlib.CheckRequest{
					Group: parsed.GVR.Group, Resource: parsed.GVR.Resource, Name: parsed.Existing.GetName(), Verb: utils.VerbGet,
				}, tt.existingFolder).Return(nil).Once()
			}
			clients := NewMockResourceClients(t)
			reader := repository.NewMockReaderWriter(t)

			require.Panics(t, func() {
				_ = NewAuthorizer(cfg, reader, access, clients, nil, true).AuthorizeResourcePreview(ctx, parsed)
			})
		})
	}
}

func TestAuthorizeResourcePreview_RequiresSourceAccess(t *testing.T) {
	for _, gvr := range []schema.GroupVersionResource{
		DashboardResource,
		dashboard.LibraryPanelResourceInfo.GroupVersionResource(),
		FolderResource,
		{Group: "example.grafana.app", Version: "v1alpha1", Resource: "widgets"},
	} {
		t.Run(gvr.Resource, func(t *testing.T) {
			serviceErr := errors.New("authorization service unavailable")
			for _, tt := range []struct {
				name string
				err  error
			}{
				{name: "denied", err: apierrors.NewForbidden(gvr.GroupResource(), "existing-resource", errors.New("no source access"))},
				{name: "access service error", err: serviceErr},
				{name: "forbidden-wrapped access service error", err: apierrors.NewForbidden(gvr.GroupResource(), "existing-resource", serviceErr)},
			} {
				t.Run(tt.name, func(t *testing.T) {
					cfg := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "preview-repo", Namespace: "default"}}
					ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
						Type: authlib.TypeUser, UserID: 42, Namespace: cfg.Namespace,
					})
					parsed := makeAuthorizeResourceParsed(t, "missing-destination", "source-folder", true)
					parsed.GVR = gvr
					parsed.FolderScoped = true
					parsed.Info = &repository.FileInfo{Path: "team/new/resource.json", Ref: "feature"}
					parsed.Obj.SetName("proposed-resource")
					parsed.Existing.SetName("existing-resource")
					if gvr.GroupResource() == FolderResource.GroupResource() {
						parsed.Info.Path = "team/new/child/_folder.json"
					}
					reader := repository.NewMockReaderWriter(t)
					clients := NewMockResourceClients(t)
					access := auth.NewMockAccessChecker(t)
					access.On("Check", ctx, authlib.CheckRequest{
						Group: gvr.Group, Resource: gvr.Resource, Name: parsed.Existing.GetName(), Verb: utils.VerbGet,
					}, "source-folder").Return(tt.err).Once()

					err := NewAuthorizer(cfg, reader, access, clients, nil, true).AuthorizeResourcePreview(ctx, parsed)
					require.ErrorIs(t, err, tt.err)
				})
			}
		})
	}
}

func TestAuthorizeResourcePreview_MatchingPRMetadataRetainsSourceCheck(t *testing.T) {
	for _, gvr := range []schema.GroupVersionResource{
		DashboardResource,
		dashboard.LibraryPanelResourceInfo.GroupVersionResource(),
		{Group: "example.grafana.app", Version: "v1alpha1", Resource: "widgets"},
	} {
		t.Run(gvr.Resource, func(t *testing.T) {
			cfg := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "preview-repo", Namespace: "default"}}
			cfg.Spec.Sync.Target = provisioning.SyncTargetTypeFolder
			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				Type: authlib.TypeUser, UserID: 42, Namespace: cfg.Namespace,
			})
			parsed := makeAuthorizeResourceParsed(t, "restricted-source", "restricted-source", true)
			parsed.FolderScoped = true
			parsed.GVR = gvr
			parsed.Info = &repository.FileInfo{Path: "team/new/resource.json", Ref: "feature"}
			ancestor := ParseFolder("team/new/", cfg.Name).ID
			reader := repository.NewMockReaderWriter(t)
			reader.EXPECT().Config().Return(cfg).Maybe()
			folderClient := &MockDynamicResourceInterface{}
			folderClient.Test(t)
			t.Cleanup(func() { folderClient.AssertExpectations(t) })
			found := false
			folderClient.On("Get", mock.Anything, ancestor, metav1.GetOptions{}, []string(nil)).
				Return(newManagedAncestorFolder(t, cfg, ancestor, "team/new/"), nil).Run(func(mock.Arguments) { found = true }).Once()
			denied := apierrors.NewForbidden(gvr.GroupResource(), parsed.Existing.GetName(), errors.New("no source access"))
			access := auth.NewMockAccessChecker(t)
			access.On("Check", ctx, authlib.CheckRequest{
				Group: gvr.Group, Resource: gvr.Resource, Name: parsed.Existing.GetName(), Verb: utils.VerbGet,
			}, "restricted-source").Return(denied).Run(func(mock.Arguments) {
				assert.True(t, found, "matching PR and DB metadata must not skip the source check when the resolved ancestor differs")
			}).Once()
			folders := NewFolderManager(reader, folderClient, NewEmptyFolderTree(), FolderKind)

			err := NewAuthorizer(cfg, reader, access, NewMockResourceClients(t), folders, false).AuthorizeResourcePreview(ctx, parsed)
			require.ErrorIs(t, err, denied)
		})
	}
}

func testResourceDirectAuthorization(t *testing.T, gvr schema.GroupVersionResource) {
	t.Helper()
	denied := apierrors.NewForbidden(gvr.GroupResource(), "test-resource", errors.New("no read permission"))
	move := func(p *ParsedResource) {
		p.Existing = p.Obj.DeepCopy()
		p.Existing.SetName("existing-resource")
		meta, err := utils.MetaAccessor(p.Existing)
		require.NoError(t, err)
		meta.SetFolder("source-folder")
	}
	type testCase struct {
		name   string
		verb   string
		result error
		modify func(*ParsedResource)
	}
	tests := []testCase{
		{name: "other ref read", verb: utils.VerbGet},
		{name: "other ref read denied", verb: utils.VerbGet, result: denied},
		{name: "default branch read", verb: utils.VerbGet, modify: func(p *ParsedResource) { p.Info.Ref = "" }},
		{name: "default branch read denied", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Info.Ref = "" }},
		{name: "explicit configured branch read", verb: utils.VerbGet, modify: func(p *ParsedResource) { p.Info.Ref = "main" }},
		{name: "explicit configured branch read denied", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Info.Ref = "main" }},
		{name: "moved resource on configured branch", verb: utils.VerbGet, modify: func(p *ParsedResource) { p.Info.Ref = "main"; move(p) }},
		{name: "same-folder existing resource update", verb: utils.VerbUpdate, modify: func(p *ParsedResource) { p.Existing = p.Obj.DeepCopy() }},
		{name: "create at sync commit", verb: utils.VerbCreate, modify: func(p *ParsedResource) { p.Info.Ref = "0123456789012345678901234567890123456789" }},
		{name: "update at sync commit", verb: utils.VerbUpdate, modify: func(p *ParsedResource) { p.Info.Ref = "0123456789012345678901234567890123456789" }},
		{name: "delete at sync commit", verb: utils.VerbDelete, modify: func(p *ParsedResource) { p.Info.Ref = "0123456789012345678901234567890123456789" }},
		{name: "create", verb: utils.VerbCreate, result: denied},
		{name: "update", verb: utils.VerbUpdate, result: denied},
		{name: "delete", verb: utils.VerbDelete, result: denied},
		{name: "moved resource create", verb: utils.VerbCreate, result: denied, modify: move},
		{name: "moved resource update", verb: utils.VerbUpdate, result: denied, modify: move},
		{name: "moved resource delete", verb: utils.VerbDelete, result: denied, modify: move},
		{name: "successful moved resource update", verb: utils.VerbUpdate, modify: move},
		{name: "not folder scoped", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.FolderScoped = false }},
		{name: "successful org-scoped read", verb: utils.VerbGet, modify: func(p *ParsedResource) {
			p.FolderScoped = false
			p.Meta.SetFolder("")
		}},
		{name: "write without source", verb: utils.VerbCreate, modify: func(p *ParsedResource) { p.Info = nil }},
		{name: "missing source", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Info = nil }},
		{name: "empty source path", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Info.Path = "" }},
		{name: "traversal", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Info.Path = "../resource.json" }},
		{name: "absolute path", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Info.Path = "/resource.json" }},
		{name: "directory", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Info.Path = "team/new/" }},
	}
	if gvr.GroupResource() != FolderResource.GroupResource() {
		tests = append(tests,
			testCase{name: "missing destination", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Meta.SetFolder("") }},
			testCase{name: "successful root read", verb: utils.VerbGet, modify: func(p *ParsedResource) { p.Meta.SetFolder("") }},
		)
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := &unstructured.Unstructured{}
			obj.SetName("test-resource")
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			meta.SetFolder("destination")
			parsed := &ParsedResource{Obj: obj, Meta: meta, GVR: gvr, FolderScoped: true,
				Info: &repository.FileInfo{Path: "team/new/resource.json", Ref: "feature"}}
			if tt.modify != nil {
				tt.modify(parsed)
			}
			access := auth.NewMockAccessChecker(t)
			name := parsed.Obj.GetName()
			if parsed.Existing != nil {
				name = parsed.Existing.GetName()
			}
			req := authlib.CheckRequest{Group: parsed.GVR.Group, Resource: parsed.GVR.Resource, Name: name, Verb: tt.verb}
			if parsed.Existing != nil && parsed.ExistingFolder() != parsed.Meta.GetFolder() {
				access.On("Check", mock.Anything, req, parsed.ExistingFolder()).Return(nil).Once()
			}
			access.On("Check", mock.Anything, req, parsed.Meta.GetFolder()).Return(tt.result).Once()
			clients := NewMockResourceClients(t)
			reader := repository.NewMockReaderWriter(t)
			err = NewAuthorizer(&provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.GitRepositoryType, Git: &provisioning.GitRepositoryConfig{Branch: "main"}}}, reader, access, clients, nil, true).
				AuthorizeResource(context.Background(), parsed, tt.verb)
			assert.Equal(t, tt.result, err)
		})
	}
}

func TestAuthorizeResourcePreview_StopsOnWrappedAccessErrors(t *testing.T) {
	for _, checker := range []struct {
		name string
		new  func(authlib.AccessChecker) auth.AccessChecker
	}{
		{name: "token", new: auth.NewTokenAccessChecker},
		{name: "session", new: auth.NewSessionAccessChecker},
		{name: "session with unmet role fallback", new: func(inner authlib.AccessChecker) auth.AccessChecker {
			return auth.NewSessionAccessChecker(inner).WithFallbackRole(identity.RoleAdmin)
		}},
	} {
		t.Run(checker.name, func(t *testing.T) {
			serviceErr := errors.New("authorization service unavailable")
			for _, tt := range []struct {
				name              string
				destinationExists bool
				moved             bool
				sourceFailure     bool
				accessErr         error
			}{
				{name: "existing destination denied", destinationExists: true},
				{name: "existing destination service error", destinationExists: true, accessErr: serviceErr},
				{name: "nearest ancestor denied"},
				{name: "nearest ancestor service error", accessErr: serviceErr},
				{name: "moved existing destination denied", moved: true, destinationExists: true},
				{name: "moved existing destination service error", moved: true, destinationExists: true, accessErr: serviceErr},
				{name: "moved nearest ancestor denied", moved: true},
				{name: "moved nearest ancestor service error", moved: true, accessErr: serviceErr},
				{name: "moved source denied", moved: true, sourceFailure: true},
				{name: "moved source service error", moved: true, sourceFailure: true, accessErr: serviceErr},
			} {
				t.Run(tt.name, func(t *testing.T) {
					cfg := &provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{Name: "preview-repo", Namespace: "default"},
						Spec: provisioning.RepositorySpec{Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeFolder,
						}},
					}
					caller := &identity.StaticRequester{
						Type: authlib.TypeUser, UserID: 42, Namespace: cfg.Namespace, OrgRole: identity.RoleViewer,
					}
					ctx := identity.WithRequester(context.Background(), caller)
					destination := ParseFolder("team/new/", cfg.Name).ID
					parent := ParseFolder("team/", cfg.Name).ID
					ancestorPaths := map[string]string{destination: "team/new/", parent: "team/", cfg.Name: ""}
					parsed := makeAuthorizeResourceParsed(t, destination, "source-folder", tt.moved)
					parsed.FolderScoped = true
					parsed.Info = &repository.FileInfo{Path: "team/new/resource.json", Ref: "feature"}
					resourceName := parsed.Obj.GetName()
					if tt.moved {
						parsed.Existing.SetName("existing-resource")
						resourceName = parsed.Existing.GetName()
					}
					reader := repository.NewMockReaderWriter(t)
					reader.EXPECT().Config().Return(cfg).Maybe()

					isProvisioning := mock.MatchedBy(func(ctx context.Context) bool {
						id, err := identity.GetRequester(ctx)
						return err == nil && identity.IsProvisioningServiceIdentity(id) && id.GetNamespace() == cfg.Namespace
					})
					folders := &MockDynamicResourceInterface{}
					folders.Test(t)
					t.Cleanup(func() { folders.AssertExpectations(t) })
					var probed, checked []string
					for _, id := range []string{destination, parent, cfg.Name} {
						if tt.sourceFailure {
							break
						}
						obj := newManagedAncestorFolder(t, cfg, id, ancestorPaths[id])
						var lookupErr error
						if id == destination && !tt.destinationExists {
							obj = nil
							lookupErr = apierrors.NewNotFound(FolderResource.GroupResource(), id)
						}
						call := folders.On("Get", isProvisioning, id, metav1.GetOptions{}, []string(nil)).Return(obj, lookupErr).
							Run(func(args mock.Arguments) { probed = append(probed, args.String(1)) })
						if id == destination || (id == parent && !tt.destinationExists) {
							call.Once()
						} else {
							call.Maybe()
						}
					}
					clients := NewMockResourceClients(t)

					checkedFolder := parent
					wantProbes := []string{destination, parent}
					if tt.destinationExists {
						checkedFolder = destination
						wantProbes = []string{destination}
					}
					if tt.sourceFailure {
						checkedFolder = "source-folder"
						wantProbes = nil
					}
					access := checker.new(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
						if folder == "source-folder" {
							require.Empty(t, probed, "source access must precede destination lookup")
						} else {
							require.Equal(t, wantProbes, probed)
						}
						require.Same(t, ctx, checkCtx)
						require.Same(t, caller, id)
						require.Equal(t, authlib.CheckRequest{
							Namespace: cfg.Namespace, Group: parsed.GVR.Group, Resource: parsed.GVR.Resource,
							Name: resourceName, Verb: utils.VerbGet,
						}, req)
						checked = append(checked, folder)
						if folder == checkedFolder {
							return authlib.CheckResponse{Allowed: false}, tt.accessErr
						}
						return authlib.CheckResponse{Allowed: true}, nil
					}))

					folderManager := NewFolderManager(reader, folders, NewEmptyFolderTree(), FolderKind)
					err := NewAuthorizer(cfg, reader, access, clients, folderManager, false).AuthorizeResourcePreview(ctx, parsed)
					require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
					if tt.accessErr != nil {
						assert.ErrorContains(t, err, serviceErr.Error())
					}
					wantChecks := []string{checkedFolder}
					if tt.moved && !tt.sourceFailure {
						wantChecks = append([]string{"source-folder"}, wantChecks...)
					}
					assert.Equal(t, wantChecks, checked, "after source access, only the first real destination ancestor may be authorized")
					assert.Equal(t, wantProbes, probed, "an authorization failure must not probe higher ancestors")
				})
			}
		})
	}
}

// TestAuthorizeCreateFolder tests authorization checks for folder creation.
func TestAuthorizeCreateFolder(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		repoName    string
		shouldAllow bool
		description string
	}{
		{
			name:        "create folder with permission",
			path:        "team-folder/",
			repoName:    "test-repo",
			shouldAllow: true,
			description: "Should allow folder creation when user has create permission on parent",
		},
		{
			name:        "create folder without permission",
			path:        "restricted-folder/",
			repoName:    "test-repo",
			shouldAllow: false,
			description: "Should deny folder creation when user lacks create permission on parent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAccess := auth.NewMockAccessChecker(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: tt.repoName,
				},
			}

			if tt.shouldAllow {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbCreate &&
						req.Group == FolderResource.Group &&
						req.Resource == FolderResource.Resource
				}), mock.Anything).Return(nil).Once()
			} else {
				mockAccess.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(assert.AnError).Once()
			}

			authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false)
			err := authorizer.AuthorizeCreateFolder(context.Background(), tt.path)

			if tt.shouldAllow {
				assert.NoError(t, err, tt.description)
			} else {
				assert.Error(t, err, tt.description)
			}
			mockAccess.AssertExpectations(t)
		})
	}
}

// TestAuthorizeDeleteByPath_Folders tests authorization checks for folder deletion via ByPath.
func TestAuthorizeDeleteByPath_Folders(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		repoName    string
		shouldAllow bool
		description string
	}{
		{
			name:        "delete folder with permission",
			path:        "team-folder/",
			repoName:    "test-repo",
			shouldAllow: true,
			description: "Should allow folder deletion when user has delete permission",
		},
		{
			name:        "delete folder without permission",
			path:        "restricted-folder/",
			repoName:    "test-repo",
			shouldAllow: false,
			description: "Should deny folder deletion when user lacks delete permission",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAccess := auth.NewMockAccessChecker(t)
			mockReader := repository.NewMockReader(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: tt.repoName,
				},
			}

			// Mock Config() call for GetFolderID
			mockReader.On("Config").Return(repo)

			// Mock Read() call to simulate metadata not found (fallback to hash-based ID)
			mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
				Return(nil, repository.ErrFileNotFound).Maybe()

			// The folder context is the PARENT folder ID, not the folder's own ID
			expectedParentFolderID := RootFolder(repo) // Root-level folders have "" as parent

			if tt.shouldAllow {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbDelete &&
						req.Group == FolderResource.Group &&
						req.Resource == FolderResource.Resource
				}), expectedParentFolderID).Return(nil).Once()
			} else {
				mockAccess.On("Check", mock.Anything, mock.Anything, expectedParentFolderID).Return(assert.AnError).Once()
			}

			authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
			err := authorizer.AuthorizeDeleteByPath(context.Background(), tt.path, "")

			if tt.shouldAllow {
				assert.NoError(t, err, tt.description)
			} else {
				assert.Error(t, err, tt.description)
			}
			mockAccess.AssertExpectations(t)
		})
	}
}

// TestAuthorizeMoveByPath_Folders tests authorization checks for folder moves via ByPath.
func TestAuthorizeMoveByPath_Folders(t *testing.T) {
	tests := []struct {
		name              string
		originalPath      string
		targetPath        string
		repoName          string
		allowSourceUpdate bool
		allowTargetCreate bool
		shouldSucceed     bool
		description       string
	}{
		{
			name:              "move folder with full permissions",
			originalPath:      "old-folder/",
			targetPath:        "new-folder/",
			repoName:          "test-repo",
			allowSourceUpdate: true,
			allowTargetCreate: true,
			shouldSucceed:     true,
			description:       "Should allow folder move when user has update on source and create on target parent",
		},
		{
			name:              "move folder without source update permission",
			originalPath:      "restricted-folder/",
			targetPath:        "new-location/",
			repoName:          "test-repo",
			allowSourceUpdate: false,
			allowTargetCreate: true,
			shouldSucceed:     false,
			description:       "Should deny folder move when user lacks update permission on source",
		},
		{
			name:              "move folder without target create permission",
			originalPath:      "allowed-folder/",
			targetPath:        "restricted-target/",
			repoName:          "test-repo",
			allowSourceUpdate: true,
			allowTargetCreate: false,
			shouldSucceed:     false,
			description:       "Should deny folder move when user lacks create permission on target parent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAccess := auth.NewMockAccessChecker(t)
			mockReader := repository.NewMockReader(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: tt.repoName,
				},
			}

			// Mock Config() call for GetFolderID
			mockReader.On("Config").Return(repo)

			// Mock Read() call to simulate metadata not found (fallback to hash-based ID)
			mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
				Return(nil, repository.ErrFileNotFound).Maybe()

			sourceFolderID := ParseFolder(tt.originalPath, tt.repoName).ID

			// Set up expectation for source folder update check
			if tt.allowSourceUpdate {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbUpdate &&
						req.Group == FolderResource.Group &&
						req.Resource == FolderResource.Resource
				}), sourceFolderID).Return(nil).Once()
			} else {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbUpdate
				}), sourceFolderID).Return(assert.AnError).Once()
			}

			// Only check target if source check passes
			if tt.allowSourceUpdate {
				if tt.allowTargetCreate {
					mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
						return req.Verb == utils.VerbCreate &&
							req.Group == FolderResource.Group &&
							req.Resource == FolderResource.Resource
					}), mock.Anything).Return(nil).Once()
				} else {
					mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
						return req.Verb == utils.VerbCreate
					}), mock.Anything).Return(assert.AnError).Once()
				}
			}

			authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
			err := authorizer.AuthorizeMoveByPath(context.Background(), tt.originalPath, tt.targetPath, "")

			if tt.shouldSucceed {
				assert.NoError(t, err, tt.description)
			} else {
				assert.Error(t, err, tt.description)
			}
			mockAccess.AssertExpectations(t)
		})
	}
}

// TestAuthorizeFolderMetadata tests authorization with folder metadata enabled
func TestAuthorizeFolderMetadata(t *testing.T) {
	tests := []struct {
		name           string
		setupReader    func(*testing.T) repository.Reader
		folderPath     string
		expectedFolder string
		shouldPass     bool
		description    string
	}{
		{
			name: "folder metadata exists - uses stable UID from _folder.json",
			setupReader: func(t *testing.T) repository.Reader {
				rw := repository.NewMockReaderWriter(t)
				repo := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
				}
				// Mock Config() for GetFolderID calls (may be called multiple times for parent)
				rw.On("Config").Return(repo).Maybe()
				// Return folder metadata with stable UID
				folderMeta := NewFolderManifest("stable-uid-123", "my-folder", FolderKind)
				data, _ := json.Marshal(folderMeta)
				rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
					Return(&repository.FileInfo{Data: data}, nil)
				// Parent folder metadata doesn't exist (root)
				rw.On("Read", mock.Anything, mock.Anything, mock.Anything).
					Return(nil, repository.ErrFileNotFound).Maybe()
				return rw
			},
			folderPath:     "my-folder/",
			expectedFolder: "", // Root folder (parent of my-folder)
			shouldPass:     true,
			description:    "Should use stable UID from _folder.json when it exists",
		},
		{
			name: "folder metadata missing - falls back to hash-based ID",
			setupReader: func(t *testing.T) repository.Reader {
				rw := repository.NewMockReaderWriter(t)
				repo := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
				}
				// Mock Config() for GetFolderID fallback (may be called multiple times)
				rw.On("Config").Return(repo).Maybe()
				// Return not found error for all _folder.json reads
				rw.On("Read", mock.Anything, mock.Anything, mock.Anything).
					Return(nil, repository.ErrFileNotFound).Maybe()
				return rw
			},
			folderPath:     "my-folder/",
			expectedFolder: "", // Root folder (parent of my-folder)
			shouldPass:     true,
			description:    "Should fall back to hash-based ID when _folder.json doesn't exist",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAccess := auth.NewMockAccessChecker(t)
			reader := tt.setupReader(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
			}

			// Set up expectation for the check with the expected folder ID
			if tt.shouldPass {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbDelete &&
						req.Group == FolderResource.Group &&
						req.Resource == FolderResource.Resource
				}), tt.expectedFolder).Return(nil).Once()
			}

			authorizer := NewAuthorizer(repo, reader, mockAccess, authTestClients(t), nil, true) // folderMetadataEnabled=true
			err := authorizer.AuthorizeDeleteByPath(context.Background(), tt.folderPath, "")

			if tt.shouldPass {
				assert.NoError(t, err, tt.description)
			} else {
				assert.Error(t, err, tt.description)
			}
			mockAccess.AssertExpectations(t)
		})
	}
}

// TestAuthorizeCreateFolderWithMetadata tests parent folder ID resolution with metadata
func TestAuthorizeCreateFolderWithMetadata(t *testing.T) {
	tests := []struct {
		name             string
		setupReader      func(*testing.T) repository.Reader
		childPath        string
		expectedParentID string
		shouldPass       bool
		description      string
	}{
		{
			name: "parent has _folder.json - uses stable UID",
			setupReader: func(t *testing.T) repository.Reader {
				rw := repository.NewMockReaderWriter(t)
				repo := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
				}
				// Mock Config() for GetFolderID calls (may be called multiple times)
				rw.On("Config").Return(repo).Maybe()
				// Parent folder metadata exists
				parentMeta := NewFolderManifest("parent-stable-uid", "parent", FolderKind)
				data, _ := json.Marshal(parentMeta)
				rw.On("Read", mock.Anything, "parent/_folder.json", "").
					Return(&repository.FileInfo{Data: data}, nil)
				// Other metadata reads fail
				rw.On("Read", mock.Anything, mock.Anything, mock.Anything).
					Return(nil, repository.ErrFileNotFound).Maybe()
				return rw
			},
			childPath:        "parent/child/",
			expectedParentID: "parent-stable-uid",
			shouldPass:       true,
			description:      "Should use parent's stable UID from _folder.json",
		},
		{
			name: "parent missing _folder.json - uses hash-based ID",
			setupReader: func(t *testing.T) repository.Reader {
				rw := repository.NewMockReaderWriter(t)
				repo := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
				}
				// Mock Config() for GetFolderID fallback (may be called multiple times)
				rw.On("Config").Return(repo).Maybe()
				// All metadata reads fail
				rw.On("Read", mock.Anything, mock.Anything, mock.Anything).
					Return(nil, repository.ErrFileNotFound).Maybe()
				return rw
			},
			childPath:        "parent/child/",
			expectedParentID: ParseFolder("parent/", "test-repo").ID,
			shouldPass:       true,
			description:      "Should use hash-based parent ID when _folder.json missing",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAccess := auth.NewMockAccessChecker(t)
			reader := tt.setupReader(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
			}

			// Expect check on the parent folder
			if tt.shouldPass {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbCreate &&
						req.Group == FolderResource.Group &&
						req.Resource == FolderResource.Resource
				}), tt.expectedParentID).Return(nil).Once()
			}

			authorizer := NewAuthorizer(repo, reader, mockAccess, authTestClients(t), nil, true)
			err := authorizer.AuthorizeCreateFolder(context.Background(), tt.childPath)

			if tt.shouldPass {
				assert.NoError(t, err, tt.description)
			} else {
				assert.Error(t, err, tt.description)
			}
			mockAccess.AssertExpectations(t)
		})
	}
}

// TestAuthorizeMoveByPathWithMetadata tests folder move authorization with metadata
func TestAuthorizeMoveByPathWithMetadata(t *testing.T) {
	t.Run("both source and target use stable UIDs from metadata", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}

		// Mock Config() for GetFolderID calls (may be called multiple times)
		rw.On("Config").Return(repo).Maybe()

		// Source folder has metadata
		sourceMeta := NewFolderManifest("source-stable-uid", "source", FolderKind)
		sourceData, _ := json.Marshal(sourceMeta)
		rw.On("Read", mock.Anything, "source/_folder.json", "").
			Return(&repository.FileInfo{Data: sourceData}, nil)

		// Target parent has metadata
		targetParentMeta := NewFolderManifest("target-parent-stable-uid", "target-parent", FolderKind)
		targetParentData, _ := json.Marshal(targetParentMeta)
		rw.On("Read", mock.Anything, "target-parent/_folder.json", "").
			Return(&repository.FileInfo{Data: targetParentData}, nil)

		// Other metadata reads fail
		rw.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess := auth.NewMockAccessChecker(t)

		// Expect update check on source with stable UID
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), "source-stable-uid").Return(nil).Once()

		// Expect create check on target parent with stable UID
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbCreate
		}), "target-parent-stable-uid").Return(nil).Once()

		authorizer := NewAuthorizer(repo, rw, mockAccess, authTestClients(t), nil, true)
		err := authorizer.AuthorizeMoveByPath(context.Background(), "source/", "target-parent/moved/", "")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
		rw.AssertExpectations(t)
	})
}

func TestAuthorizeReadAllSupported(t *testing.T) {
	t.Run("authorized - checks get on all supported resources at root", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)

		for _, kind := range []schema.GroupVersionResource{DashboardResource, FolderResource} {
			mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
				return req.Group == kind.Group &&
					req.Resource == kind.Resource &&
					req.Verb == utils.VerbGet
			}), "").Return(nil).Once()
		}

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeReadAllSupported(context.Background())

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("unauthorized on first resource - returns error immediately", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockAccess.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(assert.AnError).Once()

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeReadAllSupported(context.Background())

		assert.Error(t, err)
	})
}

func TestAuthorizeCreateAllSupported(t *testing.T) {
	t.Run("folder sync target - checks create on all supported resources in target folder", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
			},
		}
		mockAccess := auth.NewMockAccessChecker(t)

		for _, kind := range []schema.GroupVersionResource{DashboardResource, FolderResource} {
			mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
				return req.Group == kind.Group &&
					req.Resource == kind.Resource &&
					req.Verb == utils.VerbCreate
			}), "my-repo").Return(nil).Once()
		}

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeCreateAllSupported(context.Background())

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("instance sync target - checks create at root", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeInstance},
			},
		}
		mockAccess := auth.NewMockAccessChecker(t)

		for _, kind := range []schema.GroupVersionResource{DashboardResource, FolderResource} {
			mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
				return req.Group == kind.Group &&
					req.Resource == kind.Resource &&
					req.Verb == utils.VerbCreate
			}), "").Return(nil).Once()
		}

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeCreateAllSupported(context.Background())

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("unauthorized on create - returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
			},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockAccess.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(assert.AnError).Once()

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeCreateAllSupported(context.Background())

		assert.Error(t, err)
	})
}

func TestAuthorizeDeleteAllSupported(t *testing.T) {
	t.Run("authorized - checks delete on all supported resources at root", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)

		for _, kind := range []schema.GroupVersionResource{DashboardResource, FolderResource} {
			mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
				return req.Group == kind.Group &&
					req.Resource == kind.Resource &&
					req.Verb == utils.VerbDelete
			}), "").Return(nil).Once()
		}

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteAllSupported(context.Background())

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("unauthorized on first resource - returns error immediately", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockAccess.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(assert.AnError).Once()

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteAllSupported(context.Background())

		assert.Error(t, err)
	})
}

// dashboardFileInfo returns a FileInfo containing a classic dashboard JSON that
// ParseFileResource will recognise as a dashboard resource.
func dashboardFileInfo() *repository.FileInfo {
	return &repository.FileInfo{
		Data: []byte(`{"uid":"test","schemaVersion":7,"panels":[],"tags":[]}`),
	}
}

// folderManifestFileInfo returns a FileInfo containing a folder manifest -
// resolveFileGVR explicitly rejects folders (they're authorized through their
// own dedicated path), so this is useful for proving a path resolves to a
// different kind depending on which ref it's read from.
func folderManifestFileInfo() *repository.FileInfo {
	return &repository.FileInfo{
		Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"f"},"spec":{"title":"F"}}`),
	}
}

func TestAuthorizeDeleteByPath(t *testing.T) {
	t.Run("file path checks dashboard delete on parent folder", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "team-a/dashboard.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group &&
				req.Resource == DashboardResource.Resource &&
				req.Verb == utils.VerbDelete
		}), mock.AnythingOfType("string")).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/dashboard.json", "")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("root-level file checks dashboard delete on root folder", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		rootFolder := RootFolder(repo)
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Read", mock.Anything, "dashboard.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group &&
				req.Resource == DashboardResource.Resource &&
				req.Verb == utils.VerbDelete
		}), rootFolder).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "dashboard.json", "")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("directory path delegates to AuthorizeDeleteFolder", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == FolderResource.Group &&
				req.Resource == FolderResource.Resource &&
				req.Verb == utils.VerbDelete
		}), mock.AnythingOfType("string")).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/", "")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("top-level folder delete checks against the repository folder, not the instance root", func(t *testing.T) {
		// Regression (issue #127254, folder half): this passed "" for a top-level
		// directory, claiming the instance root as its parent. That left the check with
		// no folder to resolve ancestry from, so a grant on the repository folder
		// couldn't cascade - a user with Admin on the repository folder was denied
		// deleting a folder inside it. The parent is the repository's own folder.
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
			},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == FolderResource.Group &&
				req.Resource == FolderResource.Resource &&
				req.Verb == utils.VerbDelete
		}), RootFolder(repo)).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/", "")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("unauthorized file path returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "restricted/dashboard.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(assert.AnError).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "restricted/dashboard.json", "")

		assert.Error(t, err)
	})

	t.Run("non-existent file returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "unknown/file.json", "")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "read file")
	})

	t.Run("unsupported resource type returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "bad/widget.json", "").
			Return(&repository.FileInfo{
				Data: []byte(`{"apiVersion":"custom.example.io/v1","kind":"Widget","metadata":{"name":"w"}}`),
			}, nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "bad/widget.json", "")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unsupported resource type")
	})

	t.Run("folder resource in file returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "sneaky/folder.json", "").
			Return(&repository.FileInfo{
				Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"f"},"spec":{"title":"F"}}`),
			}, nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "sneaky/folder.json", "")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unsupported resource type")
	})

	t.Run("file path with folder metadata uses stable UID", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)

		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(repo).Maybe()
		parentMeta := NewFolderManifest("stable-folder-uid", "team-a", FolderKind)
		data, _ := json.Marshal(parentMeta)
		rw.On("Read", mock.Anything, "team-a/_folder.json", "").
			Return(&repository.FileInfo{Data: data}, nil)
		rw.On("Read", mock.Anything, "team-a/dashboard.json", "").
			Return(dashboardFileInfo(), nil)
		rw.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group &&
				req.Resource == DashboardResource.Resource &&
				req.Verb == utils.VerbDelete
		}), "stable-folder-uid").Return(nil).Once()

		authorizer := NewAuthorizer(repo, rw, mockAccess, authTestClients(t), nil, true)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/dashboard.json", "")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})
}

func TestAuthorizeMoveByPath(t *testing.T) {
	t.Run("file path checks update on source and create on target", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "src/dashboard.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group &&
				req.Resource == DashboardResource.Resource &&
				req.Verb == utils.VerbUpdate
		}), mock.AnythingOfType("string")).Return(nil).Once()
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group &&
				req.Resource == DashboardResource.Resource &&
				req.Verb == utils.VerbCreate
		}), mock.AnythingOfType("string")).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeMoveByPath(context.Background(), "src/dashboard.json", "dst/dashboard.json", "")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("directory path delegates to AuthorizeMoveFolder", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == FolderResource.Group &&
				req.Resource == FolderResource.Resource &&
				req.Verb == utils.VerbUpdate
		}), mock.AnythingOfType("string")).Return(nil).Once()
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == FolderResource.Group &&
				req.Resource == FolderResource.Resource &&
				req.Verb == utils.VerbCreate
		}), mock.AnythingOfType("string")).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeMoveByPath(context.Background(), "src-folder/", "dst-folder/", "")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("unauthorized on source returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "restricted/dash.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), mock.Anything).Return(assert.AnError).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeMoveByPath(context.Background(), "restricted/dash.json", "dest/dash.json", "")

		assert.Error(t, err)
	})

	t.Run("unauthorized on target returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "src/dash.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), mock.Anything).Return(nil).Once()
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbCreate
		}), mock.Anything).Return(assert.AnError).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeMoveByPath(context.Background(), "src/dash.json", "restricted/dash.json", "")

		assert.Error(t, err)
	})
}

// TestFileKindResolvesFromRef covers resolveFileGVR's ref-awareness (via
// AuthorizeDeleteByPath/AuthorizeMoveByPath, its only callers): file *content* is
// read from the caller's actual ref, with a narrow ErrRefNotFound-only fallback to
// the configured branch, while folder *identity* stays pinned regardless of ref.
func TestFileKindResolvesFromRef(t *testing.T) {
	t.Run("reads file content from the supplied ref, not the configured branch", func(t *testing.T) {
		repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test-repo"}}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "team-a/dashboard.json", "feature-branch").
			Return(dashboardFileInfo(), nil)
		// Seeded with a *different* kind on the configured branch: if resolveFileGVR
		// regressed to reading ref="" for file content, this would be picked up
		// instead and the check below would fail with "unsupported resource type".
		mockReader.On("Read", mock.Anything, "team-a/dashboard.json", "").
			Return(folderManifestFileInfo(), nil).Maybe()
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group && req.Resource == DashboardResource.Resource && req.Verb == utils.VerbDelete
		}), mock.Anything).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/dashboard.json", "feature-branch")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("falls back to the configured branch only when the ref doesn't exist yet", func(t *testing.T) {
		repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test-repo"}}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "team-a/dashboard.json", "new-branch").
			Return(nil, repository.ErrRefNotFound)
		mockReader.On("Read", mock.Anything, "team-a/dashboard.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbDelete
		}), mock.Anything).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/dashboard.json", "new-branch")

		assert.NoError(t, err)
	})

	t.Run("does not fall back on ErrFileNotFound - the branch exists, the file just isn't there", func(t *testing.T) {
		// ErrFileNotFound means the branch exists but has independent content
		// without this file - unlike ErrRefNotFound, falling back here would
		// silently authorize against a different branch's file.
		repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test-repo"}}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "team-a/dashboard.json", "feature-branch").
			Return(nil, repository.ErrFileNotFound)
		mockReader.On("Read", mock.Anything, "team-a/dashboard.json", "").
			Return(dashboardFileInfo(), nil).Maybe()
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/dashboard.json", "feature-branch")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "read file")
	})

	t.Run("AuthorizeMoveByPath resolves the source kind once from ref and reuses it for both checks", func(t *testing.T) {
		repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test-repo"}}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		// .Once(): if AuthorizeMoveByPath read the source file twice (once per
		// check) instead of resolving its kind a single time, this would fail.
		mockReader.On("Read", mock.Anything, "team-a/dashboard.json", "feature-branch").
			Return(dashboardFileInfo(), nil).Once()
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group && req.Resource == DashboardResource.Resource && req.Verb == utils.VerbUpdate
		}), mock.Anything).Return(nil).Once()
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group && req.Resource == DashboardResource.Resource && req.Verb == utils.VerbCreate
		}), mock.Anything).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeMoveByPath(context.Background(), "team-a/dashboard.json", "team-b/dashboard.json", "feature-branch")

		assert.NoError(t, err)
		mockReader.AssertExpectations(t)
		mockAccess.AssertExpectations(t)
	})

	t.Run("directory paths never read from ref - folder identity stays pinned to the configured branch", func(t *testing.T) {
		repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test-repo"}}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		// Only ref="" is registered - if a directory operation asked the reader
		// for "feature-branch" content, the mock would panic on an unexpected call.
		mockReader.On("Read", mock.Anything, mock.Anything, "").
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == FolderResource.Group && req.Resource == FolderResource.Resource && req.Verb == utils.VerbDelete
		}), mock.Anything).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), nil, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/", "feature-branch")

		assert.NoError(t, err)
	})
}

// TestDualReadWriter_ReadNewResourcePreviewWithTokenAuth exercises previews of new
// resources whose folders have not been synced to Grafana. It uses the real parser,
// authorizer, and token checker with mocked storage and ancestor-scoped grants.
// Token auth prevents the Editor role fallback from masking authorization failures.
// The cases cover branch and folder-metadata variants, allowing or denying previews
// according to ancestor permissions while preserving the caller identity and the
// resource's destination folder. Preview reads must not persist any changes.
func TestDualReadWriter_ReadNewResourcePreviewWithTokenAuth(t *testing.T) {
	forEachPreviewResource(t, testReadNewResourcePreviewWithTokenAuth)
}

func testReadNewResourcePreviewWithTokenAuth(t *testing.T, kind schema.GroupVersionKind, resource schema.GroupVersionResource) {
	t.Helper()
	resourceName := "preview-" + resource.Resource
	for _, tt := range []struct {
		name                  string
		path                  string
		ref                   string
		folderMetadata        bool
		metadataOnlyOnFeature bool
		canRead               bool
	}{
		{name: "feature branch with one missing hash folder", path: "new/dashboard.json", ref: "feature", canRead: true},
		{name: "feature branch with multiple missing hash folders", path: "new/nested/dashboard.json", ref: "feature", canRead: true},
		{name: "feature branch with one missing metadata folder", path: "new/dashboard.json", ref: "feature", folderMetadata: true, canRead: true},
		{name: "feature branch with multiple missing metadata folders", path: "new/nested/dashboard.json", ref: "feature", folderMetadata: true, canRead: true},
		{name: "folder metadata exists only on feature branch", path: "new/nested/dashboard.json", ref: "feature", folderMetadata: true, metadataOnlyOnFeature: true, canRead: true},
		{name: "configured branch awaiting sync", path: "new/nested/dashboard.json", ref: "main", folderMetadata: true, canRead: true},
		{name: "empty ref uses configured branch", path: "new/dashboard.json", canRead: true},
		{name: "configured branch read denied", path: "new/dashboard.json", ref: "main"},
		{name: "hash folder ancestor permission denied", path: "new/nested/dashboard.json", ref: "feature"},
		{name: "metadata folder ancestor permission denied", path: "new/nested/dashboard.json", ref: "feature", folderMetadata: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "synced-dashboards", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
					Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
				},
			}
			preview := tt.ref != "" && tt.ref != cfg.Branch()
			repo := repository.NewMockReaderWriter(t)
			repo.EXPECT().Config().Return(cfg).Maybe()
			repo.EXPECT().Read(mock.Anything, tt.path, tt.ref).Return(&repository.FileInfo{
				Path: tt.path,
				Ref:  tt.ref,
				Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":%q,"metadata":{"name":%q},"spec":{"title":"Preview resource"}}`, kind.GroupVersion().String(), kind.Kind, resourceName)),
			}, nil).Once()

			caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: cfg.Namespace, OrgRole: identity.RoleEditor}
			ctx := authlib.WithAuthInfo(context.Background(), caller)
			_, provisioningID, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
			require.NoError(t, err)
			provisioningContext := mock.MatchedBy(func(ctx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(ctx)
				return ok && id.GetUID() == provisioningID.GetUID() && id.GetNamespace() == cfg.Namespace
			})

			folders := &MockDynamicResourceInterface{}
			t.Cleanup(func() { folders.AssertExpectations(t) })
			var destination string
			for dir := safepath.Dir(tt.path); dir != ""; dir = safepath.Dir(dir) {
				folderID := ParseFolder(dir, cfg.Name).ID
				if tt.folderMetadata {
					folderID = "stable-" + safepath.Base(dir)
					metadataPath := safepath.Join(dir, folderMetadataFileName)
					file := &repository.FileInfo{Path: metadataPath, Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, folderID))}
					if destination == "" {
						repo.EXPECT().Read(mock.Anything, metadataPath, tt.ref).Return(file, nil).Once()
					}
					if tt.metadataOnlyOnFeature {
						repo.EXPECT().Read(mock.Anything, metadataPath, "").Return(nil, repository.ErrFileNotFound).Once()
					} else if preview {
						repo.EXPECT().Read(mock.Anything, metadataPath, "").Return(file, nil).Once()
					}
				}
				if destination == "" {
					destination = folderID
				}
				if tt.metadataOnlyOnFeature {
					folderID = ParseFolder(dir, cfg.Name).ID
				}
				if preview {
					folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
						Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), folderID)).Once()
				}
			}
			checkedFolder := destination
			if preview {
				checkedFolder = cfg.Name
				folders.On("Get", provisioningContext, cfg.Name, metav1.GetOptions{}, mock.Anything).
					Return(newManagedAncestorFolder(t, cfg, cfg.Name, ""), nil).Once()
			}

			resourceClient := &MockDynamicResourceInterface{}
			t.Cleanup(func() { resourceClient.AssertExpectations(t) })
			resourceClient.On("Get", provisioningContext, resourceName, metav1.GetOptions{}, mock.Anything).
				Return(nil, apierrors.NewNotFound(resource.GroupResource(), resourceName)).Once()
			var dryRunObject *unstructured.Unstructured
			resourceClient.On("Create", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					dryRunObject = args.Get(1).(*unstructured.Unstructured)
					require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.CreateOptions).DryRun)
				}).Return(&unstructured.Unstructured{}, nil).Once()

			clients := NewMockResourceClients(t)
			clients.EXPECT().ForKind(mock.MatchedBy(func(clientCtx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(clientCtx)
				return ok && id == caller
			}), kind).Return(resourceClient, resource, nil).Once()
			clients.EXPECT().SupportedResources().Return([]SupportedResource{
				{GroupKind: FolderKind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
				{GroupKind: kind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
			}).Once()
			parser := &parser{
				repo: provisioning.ResourceRepositoryInfo{
					Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type,
				},
				reader: repo, config: cfg, clients: clients, folderMetadataEnabled: tt.folderMetadata,
			}
			var checkedFolders []string
			access := auth.NewTokenAccessChecker(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				require.Same(t, caller, id)
				require.Equal(t, authlib.CheckRequest{
					Namespace: cfg.Namespace, Group: resource.Group, Resource: resource.Resource,
					Verb: utils.VerbGet, Name: resourceName,
				}, req)
				checkedFolders = append(checkedFolders, folder)
				return authlib.CheckResponse{Allowed: tt.canRead && folder == checkedFolder}, nil
			})).WithFallbackRole(identity.RoleViewer)
			fm := NewFolderManager(repo, folders, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(tt.folderMetadata))
			authorizer := NewAuthorizer(cfg, repo, access, clients, fm, tt.folderMetadata)
			readWriter := NewDualReadWriter(repo, parser, nil, authorizer, tt.folderMetadata)

			parsed, err := readWriter.Read(ctx, tt.path, tt.ref)
			if tt.canRead {
				require.NoError(t, err)
				require.NotNil(t, parsed)
				assert.Equal(t, provisioning.ResourceActionCreate, parsed.Action)
				assert.Nil(t, parsed.Existing)
				assert.Nil(t, parsed.Upsert)
				assert.Equal(t, destination, parsed.Meta.GetFolder())
			} else {
				require.Error(t, err)
				assert.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
				assert.Nil(t, parsed)
			}
			require.NotNil(t, dryRunObject)
			meta, err := utils.MetaAccessor(dryRunObject)
			require.NoError(t, err)
			assert.Equal(t, destination, meta.GetFolder())
			assert.Equal(t, []string{checkedFolder}, checkedFolders)
			assert.Len(t, resourceClient.Calls, 2, "preview only gets the resource and dry-runs its creation")
			for _, call := range folders.Calls {
				assert.Equal(t, "Get", call.Method, "preview must not create folders")
			}
			for _, call := range repo.Calls {
				assert.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
			}
		})
	}
}

func TestDualReadWriter_ReadPreviewAtRoot(t *testing.T) {
	for _, target := range []provisioning.SyncTargetType{provisioning.SyncTargetTypeInstance, provisioning.SyncTargetTypeFolderless} {
		t.Run(string(target), func(t *testing.T) {
			forEachPreviewResource(t, func(t *testing.T, kind schema.GroupVersionKind, resource schema.GroupVersionResource) {
				testReadPreviewAtRoot(t, kind, resource, target, "new/nested/resource.json")
			})
		})
	}
}

func testReadPreviewAtRoot(t *testing.T, kind schema.GroupVersionKind, resource schema.GroupVersionResource, target provisioning.SyncTargetType, resourcePath string) {
	t.Helper()
	for _, tt := range []struct {
		name        string
		newChecker  func(authlib.AccessChecker) auth.AccessChecker
		role        identity.RoleType
		rootAllowed bool
		wantAllowed bool
	}{
		{name: "token permits root", newChecker: auth.NewTokenAccessChecker, role: identity.RoleNone, rootAllowed: true, wantAllowed: true},
		{name: "token denies root without role fallback", newChecker: auth.NewTokenAccessChecker, role: identity.RoleViewer},
		{name: "session permits root", newChecker: auth.NewSessionAccessChecker, role: identity.RoleNone, rootAllowed: true, wantAllowed: true},
		{name: "session denies root without matching role", newChecker: auth.NewSessionAccessChecker, role: identity.RoleNone},
		{name: "session viewer fallback permits root", newChecker: auth.NewSessionAccessChecker, role: identity.RoleViewer, wantAllowed: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "root-preview", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
					Sync: provisioning.SyncOptions{Target: target},
				},
			}
			resourceName := "root-" + resource.Resource
			caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: cfg.Namespace, OrgRole: tt.role}
			ctx := identity.WithRequester(context.Background(), caller)
			callerContext := mock.MatchedBy(func(readCtx context.Context) bool {
				id, err := identity.GetRequester(readCtx)
				return err == nil && id == caller
			})
			provisioningContext := mock.MatchedBy(func(lookupCtx context.Context) bool {
				id, err := identity.GetRequester(lookupCtx)
				return err == nil && identity.IsProvisioningServiceIdentity(id) && id.GetNamespace() == cfg.Namespace
			})
			repo := repository.NewMockReaderWriter(t)
			repo.EXPECT().Config().Return(cfg)
			repo.EXPECT().Read(callerContext, resourcePath, "feature").Return(&repository.FileInfo{
				Path: resourcePath, Ref: "feature",
				Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":%q,"metadata":{"name":%q},"spec":{"title":"Root preview"}}`, kind.GroupVersion().String(), kind.Kind, resourceName)),
			}, nil).Once()
			folders := &MockDynamicResourceInterface{}
			t.Cleanup(func() { folders.AssertExpectations(t) })
			var probedFolders, expectedProbes []string
			for dir := safepath.Dir(resourcePath); dir != ""; dir = safepath.Dir(dir) {
				folderID := ParseFolder(dir, cfg.Name).ID
				expectedProbes = append(expectedProbes, folderID)
				folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
					Run(func(args mock.Arguments) { probedFolders = append(probedFolders, args.String(1)) }).
					Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), folderID)).Once()
			}
			resourceClient := &MockDynamicResourceInterface{}
			t.Cleanup(func() { resourceClient.AssertExpectations(t) })
			resourceClient.On("Get", provisioningContext, resourceName, metav1.GetOptions{}, mock.Anything).
				Return(nil, apierrors.NewNotFound(resource.GroupResource(), resourceName)).Once()
			var dryRunObject *unstructured.Unstructured
			resourceClient.On("Create", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					dryRunObject = args.Get(1).(*unstructured.Unstructured)
					require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.CreateOptions).DryRun)
				}).Return(&unstructured.Unstructured{}, nil).Once()
			clients := NewMockResourceClients(t)
			clients.EXPECT().ForKind(callerContext, kind).Return(resourceClient, resource, nil).Once()
			clients.EXPECT().SupportedResources().Return([]SupportedResource{
				{GroupKind: kind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
			}).Once()
			parser := &parser{
				repo:   provisioning.ResourceRepositoryInfo{Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type},
				reader: repo, config: cfg, clients: clients,
			}
			var checkedFolders []string
			access := tt.newChecker(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				require.Same(t, caller, id)
				require.Equal(t, authlib.CheckRequest{
					Namespace: cfg.Namespace, Group: resource.Group, Resource: resource.Resource, Name: resourceName, Verb: utils.VerbGet,
				}, req, "root authorization must retain the resource name")
				require.Empty(t, folder)
				require.Equal(t, expectedProbes, probedFolders)
				checkedFolders = append(checkedFolders, folder)
				return authlib.CheckResponse{Allowed: tt.rootAllowed}, nil
			})).WithFallbackRole(identity.RoleViewer)
			fm := NewFolderManager(repo, folders, NewEmptyFolderTree(), FolderKind)
			authorizer := NewAuthorizer(cfg, repo, access, clients, fm, false)
			readWriter := NewDualReadWriter(repo, parser, nil, authorizer, false)

			parsed, err := readWriter.Read(ctx, resourcePath, "feature")
			if tt.wantAllowed {
				require.NoError(t, err)
				require.NotNil(t, parsed)
				require.Nil(t, parsed.Existing)
				require.Nil(t, parsed.Upsert)
			} else {
				require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
				require.Nil(t, parsed)
			}
			require.Equal(t, []string{""}, checkedFolders)
			require.NotNil(t, dryRunObject)
			meta, err := utils.MetaAccessor(dryRunObject)
			require.NoError(t, err)
			destinationPath := safepath.Dir(resourcePath)
			require.Equal(t, ParseFolder(destinationPath, cfg.Name).ID, meta.GetFolder(), "root authorization must preserve the unsynced destination")
			require.Len(t, resourceClient.Calls, 2, "preview only gets the resource and dry-runs its creation")
			require.Len(t, folders.Calls, len(expectedProbes), "preview probes directories without creating or probing a root folder")
			for _, call := range repo.Calls {
				require.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
			}
		})
	}
}

func TestDualReadWriter_ReadRejectsReadableUnmanagedAncestor(t *testing.T) {
	const resourcePath = "team/new/dashboard.json"
	const resourceName = "decoy-preview-dashboard"
	cfg := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "decoy-preview-repo", Namespace: "default"},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitRepositoryType,
			Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
			Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
		},
	}
	repo := repository.NewMockReaderWriter(t)
	repo.EXPECT().Config().Return(cfg)
	repo.EXPECT().Read(mock.Anything, resourcePath, "feature").Return(&repository.FileInfo{
		Path: resourcePath, Ref: "feature",
		Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":%q,"metadata":{"name":%q},"spec":{"title":"Decoy preview"}}`, DashboardKind.GroupVersion().String(), DashboardKind.Kind, resourceName)),
	}, nil).Once()
	caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: cfg.Namespace, OrgRole: identity.RoleEditor}
	ctx := authlib.WithAuthInfo(context.Background(), caller)
	_, provisioningID, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
	require.NoError(t, err)
	provisioningContext := mock.MatchedBy(func(ctx context.Context) bool {
		id, ok := authlib.AuthInfoFrom(ctx)
		return ok && id.GetUID() == provisioningID.GetUID() && id.GetNamespace() == cfg.Namespace
	})
	decoyUID := ParseFolder(safepath.Dir(resourcePath), cfg.Name).ID
	decoy := &unstructured.Unstructured{}
	decoy.SetName(decoyUID)
	decoy.SetNamespace(cfg.Namespace)
	original := decoy.DeepCopy()
	folders := &MockDynamicResourceInterface{}
	t.Cleanup(func() { folders.AssertExpectations(t) })
	folders.On("Get", provisioningContext, decoyUID, metav1.GetOptions{}, mock.Anything).
		Return(decoy, nil).Once()
	parentUID := ParseFolder("team/", cfg.Name).ID
	folders.On("Get", provisioningContext, parentUID, metav1.GetOptions{}, mock.Anything).
		Return(newManagedAncestorFolder(t, cfg, parentUID, "team/"), nil).Once()
	resourceClient := &MockDynamicResourceInterface{}
	t.Cleanup(func() { resourceClient.AssertExpectations(t) })
	resourceClient.On("Get", provisioningContext, resourceName, metav1.GetOptions{}, mock.Anything).
		Return(nil, apierrors.NewNotFound(DashboardResource.GroupResource(), resourceName)).Once()
	resourceClient.On("Create", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.CreateOptions).DryRun)
		}).Return(&unstructured.Unstructured{}, nil).Once()
	clients := NewMockResourceClients(t)
	clients.EXPECT().ForKind(mock.Anything, DashboardKind).Return(resourceClient, DashboardResource, nil).Once()
	clients.EXPECT().SupportedResources().Return([]SupportedResource{
		{GroupKind: DashboardKind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
	}).Once()
	parser := &parser{
		repo:   provisioning.ResourceRepositoryInfo{Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type},
		reader: repo, config: cfg, clients: clients,
	}
	var checkedFolders []string
	access := auth.NewTokenAccessChecker(previewTokenAccessChecker(func(_ context.Context, id authlib.AuthInfo, _ authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
		require.Same(t, caller, id)
		checkedFolders = append(checkedFolders, folder)
		return authlib.CheckResponse{Allowed: folder == decoyUID}, nil
	})).WithFallbackRole(identity.RoleViewer)
	fm := NewFolderManager(repo, folders, NewEmptyFolderTree(), FolderKind)
	authorizer := NewAuthorizer(cfg, repo, access, clients, fm, false)
	readWriter := NewDualReadWriter(repo, parser, nil, authorizer, false)

	parsed, err := readWriter.Read(ctx, resourcePath, "feature")
	require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
	require.Nil(t, parsed)
	require.Equal(t, []string{parentUID}, checkedFolders, "only the nearest matching ancestor must be used for authorization")
	require.Equal(t, original, decoy, "preview must not claim the unmanaged folder")
	require.Len(t, folders.Calls, 2, "an ownership mismatch must be skipped before authorizing the parent")
	require.Len(t, resourceClient.Calls, 2, "preview only gets the resource and dry-runs its creation")
	for _, call := range repo.Calls {
		require.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
	}
}

// PR metadata must not select the folder used for authorization; only the
// configured branch's nearest existing folder controls access.
func TestDualReadWriter_ReadNewResourcePreviewValidatesConfiguredFolder(t *testing.T) {
	forEachPreviewResource(t, testReadNewResourcePreviewValidatesConfiguredFolder)
}

func testReadNewResourcePreviewValidatesConfiguredFolder(t *testing.T, kind schema.GroupVersionKind, resource schema.GroupVersionResource) {
	t.Helper()
	resourceName := "preview-" + resource.Resource
	for _, tt := range []struct {
		name              string
		path              string
		target            provisioning.SyncTargetType
		folderMetadata    bool
		unsynced          bool
		configuredFolder  string
		denyDestination   bool
		canReadConfigured bool
		ancestorExists    bool
		canReadAncestor   bool
		wantAllowed       bool
	}{
		{name: "allowed PR folder cannot bypass denied configured folder", folderMetadata: true, configuredFolder: "restricted-folder"},
		{name: "different allowed configured folder permits preview", folderMetadata: true, configuredFolder: "other-allowed-folder", canReadConfigured: true, wantAllowed: true},
		{name: "denied PR folder cannot override allowed configured folder", folderMetadata: true, configuredFolder: "other-allowed-folder", denyDestination: true, canReadConfigured: true, wantAllowed: true},
		{name: "matching allowed folder permits preview", folderMetadata: true, configuredFolder: "preview-folder", wantAllowed: true},
		{name: "missing hash folder requires instance root permission", target: provisioning.SyncTargetTypeInstance, unsynced: true, canReadConfigured: true},
		{name: "missing repository root before folder sync forbids preview", path: "dashboard.json", unsynced: true, canReadConfigured: true},
		{name: "matching allowed metadata folder requires ancestor permission", folderMetadata: true, configuredFolder: "preview-folder", unsynced: true, ancestorExists: true},
		{name: "matching allowed metadata folder inherits from allowed ancestor", folderMetadata: true, configuredFolder: "preview-folder", unsynced: true, ancestorExists: true, canReadAncestor: true, wantAllowed: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			resourcePath := tt.path
			if resourcePath == "" {
				resourcePath = "team/resource.json"
			}
			const metadataPath = "team/_folder.json"
			target := tt.target
			if target == "" {
				target = provisioning.SyncTargetTypeFolder
			}
			cfg := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "synced-dashboards", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
					Sync: provisioning.SyncOptions{Target: target},
				},
			}
			destination := "preview-folder"
			configuredFolder := tt.configuredFolder
			if !tt.folderMetadata {
				destination = ParentFolder(resourcePath, cfg)
				configuredFolder = destination
			}
			repo := repository.NewMockReaderWriter(t)
			repo.EXPECT().Config().Return(cfg)
			repo.EXPECT().Read(mock.Anything, resourcePath, "feature").Return(&repository.FileInfo{
				Path: resourcePath, Ref: "feature",
				Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":%q,"metadata":{"name":%q},"spec":{"title":"Preview resource"}}`, kind.GroupVersion().String(), kind.Kind, resourceName)),
			}, nil).Once()
			if tt.folderMetadata {
				repo.EXPECT().Read(mock.Anything, metadataPath, "feature").Return(&repository.FileInfo{
					Path: metadataPath, Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, destination)),
				}, nil).Once()
				repo.EXPECT().Read(mock.Anything, metadataPath, "").Return(&repository.FileInfo{
					Path: metadataPath, Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, configuredFolder)),
				}, nil).Once()
			}

			caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: cfg.Namespace, OrgRole: identity.RoleEditor}
			ctx := authlib.WithAuthInfo(context.Background(), caller)
			_, provisioningID, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
			require.NoError(t, err)
			provisioningContext := mock.MatchedBy(func(ctx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(ctx)
				return ok && id.GetUID() == provisioningID.GetUID() && id.GetNamespace() == cfg.Namespace
			})
			folders := &MockDynamicResourceInterface{}
			t.Cleanup(func() { folders.AssertExpectations(t) })
			probedFolderIDs := []string{configuredFolder}
			if tt.unsynced && safepath.Dir(resourcePath) != "" && target == provisioning.SyncTargetTypeFolder {
				probedFolderIDs = append(probedFolderIDs, cfg.Name)
			}
			for _, folderID := range probedFolderIDs {
				folderExists := !tt.unsynced || (folderID == cfg.Name && tt.ancestorExists)
				if !folderExists {
					folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
						Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), folderID)).Once()
					continue
				}
				folderPath := safepath.Dir(resourcePath)
				if folderID == cfg.Name {
					folderPath = ""
				}
				folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
					Return(newManagedAncestorFolder(t, cfg, folderID, folderPath), nil).Once()
			}

			resourceClient := &MockDynamicResourceInterface{}
			t.Cleanup(func() { resourceClient.AssertExpectations(t) })
			resourceClient.On("Get", provisioningContext, resourceName, metav1.GetOptions{}, mock.Anything).
				Return(nil, apierrors.NewNotFound(resource.GroupResource(), resourceName)).Once()
			var dryRunObject *unstructured.Unstructured
			resourceClient.On("Create", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					dryRunObject = args.Get(1).(*unstructured.Unstructured)
					require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.CreateOptions).DryRun)
				}).Return(&unstructured.Unstructured{}, nil).Once()
			clients := NewMockResourceClients(t)
			clients.EXPECT().ForKind(mock.MatchedBy(func(clientCtx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(clientCtx)
				return ok && id == caller
			}), kind).Return(resourceClient, resource, nil).Once()
			clients.EXPECT().SupportedResources().Return([]SupportedResource{
				{GroupKind: FolderKind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
				{GroupKind: kind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
			}).Once()
			parser := &parser{
				repo:   provisioning.ResourceRepositoryInfo{Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type},
				reader: repo, config: cfg, clients: clients, folderMetadataEnabled: tt.folderMetadata,
			}
			var checkedFolders []string
			access := auth.NewTokenAccessChecker(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				require.Same(t, caller, id)
				require.Equal(t, authlib.CheckRequest{
					Namespace: cfg.Namespace, Group: resource.Group, Resource: resource.Resource,
					Verb: utils.VerbGet, Name: resourceName,
				}, req)
				checkedFolders = append(checkedFolders, folder)
				allowed := (!tt.denyDestination && folder == destination) ||
					(tt.canReadConfigured && folder == configuredFolder) ||
					(tt.canReadAncestor && folder == cfg.Name)
				return authlib.CheckResponse{Allowed: allowed}, nil
			})).WithFallbackRole(identity.RoleViewer)
			fm := NewFolderManager(repo, folders, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(tt.folderMetadata))
			authorizer := NewAuthorizer(cfg, repo, access, clients, fm, tt.folderMetadata)
			readWriter := NewDualReadWriter(repo, parser, nil, authorizer, tt.folderMetadata)

			parsed, err := readWriter.Read(ctx, resourcePath, "feature")
			if tt.wantAllowed {
				require.NoError(t, err)
				require.NotNil(t, parsed)
				assert.Nil(t, parsed.Existing)
				assert.Nil(t, parsed.Upsert)
				assert.Equal(t, destination, parsed.Meta.GetFolder())
			} else {
				require.Error(t, err)
				assert.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
				assert.Nil(t, parsed)
			}
			var checkedFolderIDs []string
			if !tt.unsynced {
				checkedFolderIDs = append(checkedFolderIDs, configuredFolder)
			} else if tt.ancestorExists {
				checkedFolderIDs = append(checkedFolderIDs, cfg.Name)
			} else if target == provisioning.SyncTargetTypeInstance {
				checkedFolderIDs = append(checkedFolderIDs, "")
			}
			assert.Equal(t, checkedFolderIDs, checkedFolders)
			require.NotNil(t, dryRunObject)
			meta, err := utils.MetaAccessor(dryRunObject)
			require.NoError(t, err)
			assert.Equal(t, destination, meta.GetFolder())
			assert.Len(t, resourceClient.Calls, 2, "preview only gets the resource and dry-runs its creation")
			for _, call := range folders.Calls {
				assert.Equal(t, "Get", call.Method, "preview must not create folders")
			}
			for _, call := range repo.Calls {
				assert.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
			}
		})
	}
}

func TestDualReadWriter_ReadMovedResourcePreviewWithTokenAuth(t *testing.T) {
	forEachPreviewResource(t, testReadMovedResourcePreviewWithTokenAuth)
}

type movedResourcePreviewCase struct {
	name                  string
	folderMetadata        bool
	metadataOnlyOnFeature bool
	configuredFolder      string
	canReadSource         bool
	canReadAncestor       bool
	noAncestor            bool
	sameFolder            bool
	sourceMatchesAncestor bool
	wantAllowed           bool
}

type movedResourcePreviewFixture struct {
	folderMetadata        bool
	resourceName          string
	resourcePath          string
	sourcePath            string
	sourceFolder          string
	destination           string
	ancestor              string
	configuredDestination string
	resolvedFolder        string
	checkSource           bool
	lookupAncestors       bool
}

func newMovedResourcePreviewFixture(tt movedResourcePreviewCase, resource schema.GroupVersionResource, repoName string) movedResourcePreviewFixture {
	f := movedResourcePreviewFixture{
		folderMetadata: tt.folderMetadata,
		resourceName:   "existing-" + resource.Resource,
		resourcePath:   "team/renamed/resource.json",
		sourcePath:     "team/original/resource.json",
		sourceFolder:   ParseFolder("team/original/", repoName).ID,
		destination:    ParseFolder("team/renamed/", repoName).ID,
		ancestor:       ParseFolder("team/", repoName).ID,
	}
	if f.folderMetadata {
		f.sourceFolder, f.destination = "source-folder", "destination-folder"
		if !tt.metadataOnlyOnFeature {
			f.ancestor = "team-folder"
		}
	}
	if tt.sameFolder {
		f.sourceFolder = f.destination
		f.sourcePath = "team/renamed/previous.json"
	}
	if tt.sourceMatchesAncestor {
		f.sourceFolder = f.ancestor
		f.sourcePath = "team/resource.json"
	}
	f.configuredDestination = f.destination
	if tt.metadataOnlyOnFeature {
		f.configuredDestination = ParseFolder("team/renamed/", repoName).ID
	} else if tt.configuredFolder != "" {
		f.configuredDestination = tt.configuredFolder
	}
	f.resolvedFolder = f.ancestor
	if tt.sameFolder {
		f.resolvedFolder = f.configuredDestination
	}
	f.checkSource = f.sourceFolder != f.destination
	f.lookupAncestors = !f.checkSource || tt.canReadSource
	return f
}

func (f movedResourcePreviewFixture) expectRepositoryReads(t *testing.T, tt movedResourcePreviewCase, cfg *provisioning.Repository, kind schema.GroupVersionKind) *repository.MockReaderWriter {
	t.Helper()
	repo := repository.NewMockReaderWriter(t)
	repo.EXPECT().Config().Return(cfg).Maybe()
	repo.EXPECT().Read(mock.Anything, f.resourcePath, "feature").Return(&repository.FileInfo{
		Path: f.resourcePath, Ref: "feature",
		Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":%q,"metadata":{"name":%q},"spec":{"title":"Moved resource"}}`, kind.GroupVersion().String(), kind.Kind, f.resourceName)),
	}, nil).Once()
	if !f.folderMetadata {
		return repo
	}

	metadataPath := "team/renamed/_folder.json"
	metadata := &repository.FileInfo{Path: metadataPath, Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, f.destination))}
	repo.EXPECT().Read(mock.Anything, metadataPath, "feature").Return(metadata, nil).Once()
	if !f.lookupAncestors {
		return repo
	}

	if tt.metadataOnlyOnFeature {
		repo.EXPECT().Read(mock.Anything, metadataPath, "").Return(nil, repository.ErrFileNotFound).Once()
	} else {
		repo.EXPECT().Read(mock.Anything, metadataPath, "").Return(&repository.FileInfo{
			Path: metadataPath, Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, f.configuredDestination)),
		}, nil).Once()
	}
	if !tt.sameFolder {
		if tt.metadataOnlyOnFeature {
			repo.EXPECT().Read(mock.Anything, "team/_folder.json", "").Return(nil, repository.ErrFileNotFound).Once()
		} else {
			repo.EXPECT().Read(mock.Anything, "team/_folder.json", "").Return(&repository.FileInfo{
				Path: "team/_folder.json", Data: []byte(fmt.Sprintf(`{"metadata":{"name":%q}}`, f.ancestor)),
			}, nil).Once()
		}
	}
	return repo
}

func (f movedResourcePreviewFixture) expectFolderProbes(t *testing.T, tt movedResourcePreviewCase, cfg *provisioning.Repository, provisioningContext interface{}, checkedFolders *[]string) *MockDynamicResourceInterface {
	t.Helper()
	folders := &MockDynamicResourceInterface{}
	t.Cleanup(func() { folders.AssertExpectations(t) })
	var probedFolders []string
	if f.lookupAncestors {
		probedFolders = append(probedFolders, f.configuredDestination)
		if !tt.sameFolder {
			probedFolders = append(probedFolders, f.ancestor)
		}
		if tt.noAncestor {
			probedFolders = append(probedFolders, cfg.Name)
		}
	}
	for _, folderID := range probedFolders {
		checkOrder := func(mock.Arguments) {
			if f.checkSource {
				require.Equal(t, []string{f.sourceFolder}, *checkedFolders, "authorize the existing resource before probing ancestors")
			} else {
				require.Empty(t, *checkedFolders, "resolve the configured ancestor before checking same-folder access")
			}
		}
		folderExists := !tt.noAncestor && folderID == f.resolvedFolder
		if !folderExists {
			folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
				Run(checkOrder).Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), folderID)).Once()
		} else {
			folderPath := "team/"
			if tt.sameFolder {
				folderPath = safepath.Dir(f.resourcePath)
			}
			folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
				Run(checkOrder).
				Return(newManagedAncestorFolder(t, cfg, folderID, folderPath), nil).Once()
		}
	}
	return folders
}

func testReadMovedResourcePreviewWithTokenAuth(t *testing.T, kind schema.GroupVersionKind, resource schema.GroupVersionResource) {
	t.Helper()
	for _, tt := range []movedResourcePreviewCase{
		{name: "directory rename inherits allowed hash ancestor", canReadSource: true, canReadAncestor: true, wantAllowed: true},
		{name: "directory rename respects denied hash ancestor", canReadSource: true},
		{name: "directory rename requires source permission", canReadAncestor: true},
		{name: "metadata move inherits allowed ancestor", folderMetadata: true, canReadSource: true, canReadAncestor: true, wantAllowed: true},
		{name: "metadata move respects denied ancestor", folderMetadata: true, canReadSource: true},
		{name: "metadata move requires source permission", folderMetadata: true, canReadAncestor: true},
		{name: "feature-only metadata uses configured hash ancestor", folderMetadata: true, metadataOnlyOnFeature: true, canReadSource: true, canReadAncestor: true, wantAllowed: true},
		{name: "move without any real ancestor is forbidden", canReadSource: true, canReadAncestor: true, noAncestor: true},
		{name: "same-folder rename retains original resource check", folderMetadata: true, canReadSource: true, sameFolder: true, wantAllowed: true},
		{name: "same-folder rename respects denied resource permission", folderMetadata: true, sameFolder: true},
		{name: "same-folder PR metadata cannot bypass denied configured folder", folderMetadata: true, configuredFolder: "restricted-folder", canReadSource: true, sameFolder: true},
		{name: "same-folder PR metadata permits allowed configured folder", folderMetadata: true, configuredFolder: "other-allowed-folder", canReadSource: true, canReadAncestor: true, sameFolder: true, wantAllowed: true},
		{name: "source folder is the nearest configured ancestor", folderMetadata: true, canReadSource: true, canReadAncestor: true, sourceMatchesAncestor: true, wantAllowed: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "synced-resources", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
					Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
				},
			}
			f := newMovedResourcePreviewFixture(tt, resource, cfg.Name)
			repo := f.expectRepositoryReads(t, tt, cfg, kind)

			caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: cfg.Namespace, OrgRole: identity.RoleEditor}
			ctx := authlib.WithAuthInfo(context.Background(), caller)
			_, provisioningID, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
			require.NoError(t, err)
			provisioningContext := mock.MatchedBy(func(ctx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(ctx)
				return ok && id.GetUID() == provisioningID.GetUID() && id.GetNamespace() == cfg.Namespace
			})
			var checkedFolders []string
			folders := f.expectFolderProbes(t, tt, cfg, provisioningContext, &checkedFolders)

			existing := &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": f.resourceName, "namespace": cfg.Namespace, "resourceVersion": "42"},
			}}
			existingMeta, err := utils.MetaAccessor(existing)
			require.NoError(t, err)
			existingMeta.SetFolder(f.sourceFolder)
			existingMeta.SetSourceProperties(utils.SourceProperties{Path: f.sourcePath})
			existingMeta.SetManagerProperties(utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: cfg.Name})
			resourceClient := &MockDynamicResourceInterface{}
			t.Cleanup(func() { resourceClient.AssertExpectations(t) })
			resourceClient.On("Get", provisioningContext, f.resourceName, metav1.GetOptions{}, mock.Anything).
				Return(existing, nil).Once()
			var dryRunObject *unstructured.Unstructured
			resourceClient.On("Update", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					dryRunObject = args.Get(1).(*unstructured.Unstructured)
					require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.UpdateOptions).DryRun)
				}).Return(&unstructured.Unstructured{}, nil).Once()
			clients := NewMockResourceClients(t)
			clients.EXPECT().ForKind(mock.MatchedBy(func(clientCtx context.Context) bool {
				id, ok := authlib.AuthInfoFrom(clientCtx)
				return ok && id == caller
			}), kind).Return(resourceClient, resource, nil).Once()
			clients.EXPECT().SupportedResources().Return([]SupportedResource{
				{GroupKind: kind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
			}).Once()
			parser := &parser{
				repo:   provisioning.ResourceRepositoryInfo{Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type},
				reader: repo, config: cfg, clients: clients, folderMetadataEnabled: f.folderMetadata,
			}
			access := auth.NewTokenAccessChecker(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				require.Same(t, caller, id)
				require.Equal(t, authlib.CheckRequest{
					Namespace: cfg.Namespace, Group: resource.Group, Resource: resource.Resource,
					Verb: utils.VerbGet, Name: f.resourceName,
				}, req)
				checkedFolders = append(checkedFolders, folder)
				allowed := (folder == f.sourceFolder && tt.canReadSource) || (folder == f.resolvedFolder && tt.canReadAncestor)
				return authlib.CheckResponse{Allowed: allowed}, nil
			})).WithFallbackRole(identity.RoleViewer)
			fm := NewFolderManager(repo, folders, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(f.folderMetadata))
			authorizer := NewAuthorizer(cfg, repo, access, clients, fm, f.folderMetadata)
			readWriter := NewDualReadWriter(repo, parser, nil, authorizer, f.folderMetadata)

			parsed, err := readWriter.Read(ctx, f.resourcePath, "feature")
			if tt.wantAllowed {
				require.NoError(t, err)
				require.NotNil(t, parsed)
				assert.Same(t, existing, parsed.Existing)
				assert.Equal(t, provisioning.ResourceActionUpdate, parsed.Action)
				assert.Nil(t, parsed.Upsert)
				assert.Equal(t, f.destination, parsed.Meta.GetFolder())
			} else {
				require.Error(t, err)
				assert.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
				assert.Nil(t, parsed)
			}
			wantChecks := []string{f.sourceFolder}
			if tt.canReadSource && !tt.noAncestor && (!tt.sameFolder || f.configuredDestination != f.destination) {
				wantChecks = append(wantChecks, f.resolvedFolder)
			}
			assert.Equal(t, wantChecks, checkedFolders)
			require.NotNil(t, dryRunObject)
			meta, err := utils.MetaAccessor(dryRunObject)
			require.NoError(t, err)
			assert.Equal(t, f.resourceName, dryRunObject.GetName())
			assert.Equal(t, "42", dryRunObject.GetResourceVersion())
			assert.Equal(t, f.destination, meta.GetFolder())
			assert.Equal(t, f.sourceFolder, existingMeta.GetFolder(), "preview must not mutate the existing resource")
			assert.Len(t, resourceClient.Calls, 2, "preview only gets the existing resource and dry-runs its update")
			for _, call := range folders.Calls {
				assert.Equal(t, "Get", call.Method, "preview must not create folders")
			}
			for _, call := range repo.Calls {
				assert.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
			}
		})
	}
}

func forEachPreviewResource(t *testing.T, run func(*testing.T, schema.GroupVersionKind, schema.GroupVersionResource)) {
	t.Helper()
	for _, resource := range []struct {
		kind     schema.GroupVersionKind
		resource schema.GroupVersionResource
	}{
		{kind: DashboardKind, resource: DashboardResource},
		{kind: dashboard.LibraryPanelResourceInfo.GroupVersionKind(), resource: dashboard.LibraryPanelResourceInfo.GroupVersionResource()},
		{
			kind:     schema.GroupVersionKind{Group: "example.grafana.app", Version: "v1alpha1", Kind: "Widget"},
			resource: schema.GroupVersionResource{Group: "example.grafana.app", Version: "v1alpha1", Resource: "widgets"},
		},
	} {
		t.Run(resource.kind.Kind, func(t *testing.T) {
			run(t, resource.kind, resource.resource)
		})
	}
}

type previewTokenAccessChecker func(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error)

func (f previewTokenAccessChecker) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return f(ctx, id, req, folder)
}

func TestAuthorizeResourcePreview_Eligibility(t *testing.T) {
	cfg := &provisioning.Repository{Spec: provisioning.RepositorySpec{
		Type: provisioning.GitRepositoryType, Git: &provisioning.GitRepositoryConfig{Branch: "main"},
	}}
	for _, tt := range []struct {
		name   string
		path   string
		modify func(*ParsedResource)
		want   bool
	}{
		{name: "nested JSON", path: "team/nested/resource.json", want: true},
		{name: "YAML", path: "team/resource.yaml", want: true},
		{name: "YML", path: "team/resource.yml", want: true},
		{name: "root resource with wrapper folder", path: "resource.json", want: true},
		{name: "root resource without wrapper folder", path: "resource.json", modify: func(p *ParsedResource) { p.Meta.SetFolder("") }},
		{name: "configured branch", path: "team/resource.json", modify: func(p *ParsedResource) { p.Info.Ref = "main" }},
		{name: "implicit configured branch", path: "team/resource.json", modify: func(p *ParsedResource) { p.Info.Ref = "" }},
		{name: "not folder scoped", path: "team/resource.json", modify: func(p *ParsedResource) { p.FolderScoped = false }},
		{name: "missing source", modify: func(p *ParsedResource) { p.Info = nil }},
		{name: "empty source path"},
		{name: "missing folder annotation", path: "team/resource.json", modify: func(p *ParsedResource) { p.Meta.SetFolder("") }},
		{name: "folder with parent annotation", path: "team/nested/_folder.json", modify: func(p *ParsedResource) { p.GVR = FolderResource }},
		{name: "folder without parent annotation", path: "team/_folder.json", modify: func(p *ParsedResource) {
			p.GVR = FolderResource
			p.Meta.SetFolder("")
		}},
		{name: "directory", path: "team/"},
		{name: "unsupported extension", path: "team/resource.txt"},
		{name: "raw readable file", path: "team/README.md"},
		{name: "absolute path", path: "/team/resource.json"},
		{name: "parent traversal", path: "../resource.json"},
		{name: "nested traversal", path: "team/../resource.json"},
		{name: "excessive depth", path: strings.Repeat("nested/", maxPathDepth+1) + "resource.json"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			obj := &unstructured.Unstructured{}
			obj.SetName("test-resource")
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			meta.SetFolder("destination-folder")
			parsed := &ParsedResource{
				Obj: obj, Meta: meta, GVR: DashboardResource, FolderScoped: true,
				Info: &repository.FileInfo{Path: tt.path, Ref: "feature"},
			}
			if tt.modify != nil {
				tt.modify(parsed)
			}

			folders := NewMockFolderAncestorFinder(t)
			wantFolder := parsed.Meta.GetFolder()
			if tt.want {
				wantFolder = "configured-ancestor"
				folders.EXPECT().FindExistingAncestor(t.Context(), safepath.Dir(tt.path), "").Return(wantFolder, true, nil).Once()
			}
			access := auth.NewMockAccessChecker(t)
			access.EXPECT().Check(t.Context(), authlib.CheckRequest{
				Group: parsed.GVR.Group, Resource: parsed.GVR.Resource, Name: parsed.Obj.GetName(), Verb: utils.VerbGet,
			}, wantFolder).Return(nil).Once()
			authorizer := NewAuthorizer(cfg, repository.NewMockReader(t), access, NewMockResourceClients(t), folders, true)
			require.NoError(t, authorizer.AuthorizeResourcePreview(t.Context(), parsed))
		})
	}
}
