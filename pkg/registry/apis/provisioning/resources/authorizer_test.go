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
	"k8s.io/client-go/dynamic"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
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

func TestAuthorizeResource_ReadExistingAncestor(t *testing.T) {
	for _, gvr := range []schema.GroupVersionResource{
		DashboardResource,
		DashboardResourceV2beta1,
		dashboard.LibraryPanelResourceInfo.GroupVersionResource(),
		FolderResource,
		{Group: "example.grafana.app", Version: "v1alpha1", Resource: "widgets"},
	} {
		t.Run(gvr.Resource+"/"+gvr.Version, func(t *testing.T) {
			states := []string{"new", "moved", "same-folder"}
			if gvr.GroupResource() == FolderResource.GroupResource() {
				states = []string{"new", "moved"}
			}
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
	if gvr.GroupResource() == FolderResource.GroupResource() {
		parsed.Info.Path = strings.TrimSuffix(parsed.Info.Path, "resource.json") + "_folder.json"
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
			name: "unknown repository target cannot use an implicit root", target: provisioning.SyncTargetType("unknown"),
			wantProbes: []string{newID, teamID}, wantForbidden: true,
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
			metadataEnabled := tt.metadataEnabled || gvr.GroupResource() == FolderResource.GroupResource()
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
				name := resourceName
				if gvr.GroupResource() == FolderResource.GroupResource() {
					name = id
				}
				access.On("Check", ctx, authlib.CheckRequest{
					Group: parsed.GVR.Group, Resource: parsed.GVR.Resource, Name: name, Verb: utils.VerbGet,
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
			err := NewAuthorizer(cfg, reader, access, clients, folders, metadataEnabled).AuthorizeResource(ctx, parsed, utils.VerbGet)
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

func TestAuthorizeResource_ReadUsesRoot(t *testing.T) {
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
		FolderResource,
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
					reader := repository.NewMockReaderWriter(t)
					reader.EXPECT().Config().Return(cfg).Maybe()
					expectConfiguredAncestorMetadata(t, reader, caller, nil, nil)
					folderClient := &MockDynamicResourceInterface{}
					folderClient.Test(t)
					t.Cleanup(func() { folderClient.AssertExpectations(t) })
					wantProbes := []string{ParseFolder("team/new/", cfg.Name).ID, ParseFolder("team/", cfg.Name).ID}
					if tt.state == "moved" && tt.denySource {
						wantProbes = nil
					}
					var probes []string
					for _, id := range wantProbes {
						folderClient.On("Get", mock.Anything, id, metav1.GetOptions{}, []string(nil)).
							Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), id)).
							Run(func(args mock.Arguments) { probes = append(probes, args.String(1)) }).Once()
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
								assert.Empty(t, probes, "moved source must be authorized before ancestor lookup")
							} else {
								assert.Equal(t, wantProbes, probes, "matching metadata must retain the source check after ancestor lookup")
							}
						}).Once()
					}
					if !tt.denySource {
						var rootErr error
						if tt.denyRoot {
							rootErr = denied
						}
						access.On("Check", ctx, req, "").Return(rootErr).Run(func(mock.Arguments) {
							assert.Equal(t, wantProbes, probes, "root access must follow the complete ancestor lookup")
						}).Once()
					}
					folders := NewFolderManager(reader, folderClient, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))

					err := NewAuthorizer(cfg, reader, access, NewMockResourceClients(t), folders, true).AuthorizeResource(ctx, parsed, utils.VerbGet)
					if tt.denySource || tt.denyRoot {
						require.ErrorIs(t, err, denied)
					} else {
						require.NoError(t, err)
					}
					assert.Equal(t, wantProbes, probes)
					if parsed.Existing == nil {
						access.AssertNotCalled(t, "Check", ctx, req, destination)
					}
				})
			}
		})
	}
}

func TestAuthorizeResource_ReadRejectsUnrelatedAncestor(t *testing.T) {
	cfg := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "preview-repo", Namespace: "default"}}
	cfg.Spec.Sync.Target = provisioning.SyncTargetTypeFolder
	manager := utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: cfg.Name}
	otherRepo := utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "other-repo"}
	for _, gvr := range []schema.GroupVersionResource{DashboardResource, FolderResource} {
		t.Run(gvr.Resource, func(t *testing.T) {
			for _, tt := range []struct {
				name       string
				manager    utils.ManagerProperties
				sourcePath string
				root       bool
				target     provisioning.SyncTargetType
			}{
				{name: "unmanaged folder", sourcePath: "team/new/"},
				{name: "different manager kind", manager: utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: cfg.Name}, sourcePath: "team/new/"},
				{name: "different repository", manager: otherRepo, sourcePath: "team/new/"},
				{name: "different source path", manager: manager, sourcePath: "elsewhere/"},
				{name: "missing source path", manager: manager},
				{name: "unmanaged root", root: true},
				{name: "different repository root", manager: otherRepo, root: true},
				{name: "mislocated root", manager: manager, sourcePath: "team/", root: true},
				{name: "folderless unmanaged folder", sourcePath: "team/new/", target: provisioning.SyncTargetTypeFolderless},
				{name: "folderless different repository", manager: otherRepo, sourcePath: "team/new/", target: provisioning.SyncTargetTypeFolderless},
				{name: "folderless different source path", manager: manager, sourcePath: "elsewhere/", target: provisioning.SyncTargetTypeFolderless},
				{name: "instance unmanaged folder", sourcePath: "team/new/", target: provisioning.SyncTargetTypeInstance},
				{name: "instance different repository", manager: otherRepo, sourcePath: "team/new/", target: provisioning.SyncTargetTypeInstance},
				{name: "instance different source path", manager: manager, sourcePath: "elsewhere/", target: provisioning.SyncTargetTypeInstance},
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
					for id, ancestorPath := range map[string]string{ParseFolder("team/", cfg.Name).ID: "team/", cfg.Name: ""} {
						if id != decoyID {
							folderClient.On("Get", mock.Anything, id, metav1.GetOptions{}, []string(nil)).
								Return(newManagedAncestorFolder(t, cfg, id, ancestorPath), nil).
								Run(func(args mock.Arguments) { probes = append(probes, args.String(1)) }).Maybe()
						}
					}
					access := auth.NewMockAccessChecker(t)
					access.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil).Maybe()
					folders := NewFolderManager(reader, folderClient, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))

					err = NewAuthorizer(cfg, reader, access, NewMockResourceClients(t), folders, true).AuthorizeResource(ctx, parsed, utils.VerbGet)
					require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
					assert.Equal(t, []string{decoyID}, probes, "an unrelated folder must prevent ancestor fallback")
					access.AssertNotCalled(t, "Check", mock.Anything, mock.Anything, mock.Anything)
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

func TestAuthorizeResource_ReadRequiresFolderManager(t *testing.T) {
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

			err := NewAuthorizer(cfg, reader, access, clients, nil, true).AuthorizeResource(ctx, parsed, utils.VerbGet)
			require.EqualError(t, err, "folder manager is required for read authorization")
		})
	}
}

func TestAuthorizeResource_ReadRequiresSourceAccess(t *testing.T) {
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

					err := NewAuthorizer(cfg, reader, access, clients, nil, true).AuthorizeResource(ctx, parsed, utils.VerbGet)
					require.ErrorIs(t, err, tt.err)
				})
			}
		})
	}
}

func TestAuthorizeResource_ReadMatchingPRMetadataRetainsSourceCheck(t *testing.T) {
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

			err := NewAuthorizer(cfg, reader, access, NewMockResourceClients(t), folders, false).AuthorizeResource(ctx, parsed, utils.VerbGet)
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
	tests := []struct {
		name   string
		verb   string
		result error
		modify func(*ParsedResource)
	}{
		{name: "same-folder existing resource update", verb: utils.VerbUpdate, modify: func(p *ParsedResource) { p.Existing = p.Obj.DeepCopy() }},
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
		{name: "missing destination", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Meta.SetFolder("") }},
		{name: "successful root read", verb: utils.VerbGet, modify: func(p *ParsedResource) { p.Meta.SetFolder("") }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := &unstructured.Unstructured{}
			obj.SetName("test-resource")
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			meta.SetFolder("destination")
			parsed := &ParsedResource{Obj: obj, Meta: meta, GVR: gvr, FolderScoped: true,
				Info: &repository.FileInfo{Path: "team/new/resource.json"}}
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
			err = NewAuthorizer(&provisioning.Repository{}, reader, access, clients, nil, true).
				AuthorizeResource(context.Background(), parsed, tt.verb)
			assert.Equal(t, tt.result, err)
		})
	}
}

func TestAuthorizeResource_ExistingFolderUsesConfiguredDirectory(t *testing.T) {
	cfg := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "preview-repo", Namespace: "default"}}
	cfg.Spec.Sync.Target = provisioning.SyncTargetTypeFolder
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type: authlib.TypeUser, UserID: 42, Namespace: cfg.Namespace,
	})
	parent := ParseFolder("team/", cfg.Name).ID
	destination := ParseFolder("team/new/", cfg.Name).ID
	ancestorPaths := map[string]string{
		parent: "team/", destination: "team/new/", cfg.Name: "",
		"existing-folder": "team/new/child/", "configured-folder": "team/new/child/",
	}
	denied := apierrors.NewForbidden(FolderResource.GroupResource(), "existing-folder", errors.New("no read permission"))
	for _, tt := range []struct {
		name           string
		fileParent     string
		existingParent string
		configuredID   string
		existing       []string
		wantProbes     []string
		wantNames      []string
		wantFolders    []string
		probesAtCheck  []int
		denyName       string
		wantForbidden  bool
	}{
		{
			name: "unchanged folder checks its own configured UID without reading the parent", fileParent: destination, existingParent: destination,
			existing: []string{"existing-folder"}, wantProbes: []string{"existing-folder"}, wantNames: []string{"existing-folder"},
			wantFolders: []string{"existing-folder"}, probesAtCheck: []int{1},
		},
		{
			name: "own UID denial does not fall back to an allowed parent", fileParent: destination, existingParent: destination,
			existing: []string{"existing-folder", destination}, wantProbes: []string{"existing-folder"}, wantNames: []string{"existing-folder"},
			wantFolders: []string{"existing-folder"}, probesAtCheck: []int{1}, denyName: "existing-folder", wantForbidden: true,
		},
		{
			name: "move within existing ancestor checks own UID and ancestor", fileParent: destination, existingParent: parent,
			existing: []string{parent}, wantProbes: []string{"existing-folder", destination, parent}, wantNames: []string{"existing-folder", parent},
			wantFolders: []string{parent, parent}, probesAtCheck: []int{0, 3},
		},
		{
			name: "spoofed PR parent cannot hide missing configured directories", fileParent: parent, existingParent: parent,
			existing: []string{parent}, wantProbes: []string{"existing-folder", destination, parent}, wantNames: []string{"existing-folder", parent},
			wantFolders: []string{parent, parent}, probesAtCheck: []int{3, 3},
		},
		{
			name: "different PR parent retains source and configured folder checks", fileParent: "pr-controlled-parent", existingParent: destination,
			existing: []string{"existing-folder"}, wantProbes: []string{"existing-folder"}, wantNames: []string{"existing-folder", "existing-folder"},
			wantFolders: []string{destination, "existing-folder"}, probesAtCheck: []int{0, 1},
		},
		{
			name: "missing folder retains own UID before checking ancestor", fileParent: destination, existingParent: destination,
			existing: []string{parent}, wantProbes: []string{"existing-folder", destination, parent}, wantNames: []string{"existing-folder", parent},
			wantFolders: []string{destination, parent}, probesAtCheck: []int{3, 3},
		},
		{
			name: "existing ancestor does not bypass own UID denial", fileParent: destination, existingParent: destination,
			existing: []string{destination}, wantProbes: []string{"existing-folder", destination}, wantNames: []string{"existing-folder"},
			wantFolders: []string{destination}, probesAtCheck: []int{2}, denyName: "existing-folder", wantForbidden: true,
		},
		{
			name: "own UID grant does not bypass configured ancestor denial", fileParent: parent, existingParent: parent,
			existing: []string{parent}, wantProbes: []string{"existing-folder", destination, parent}, wantNames: []string{"existing-folder", parent},
			wantFolders: []string{parent, parent}, probesAtCheck: []int{3, 3}, denyName: parent, wantForbidden: true,
		},
		{
			name: "different configured UID checks actual source before destination", fileParent: destination, existingParent: destination,
			configuredID: "configured-folder", existing: []string{"configured-folder"}, wantProbes: []string{"configured-folder"},
			wantNames: []string{"existing-folder", "configured-folder"}, wantFolders: []string{destination, "configured-folder"}, probesAtCheck: []int{1, 1},
		},
		{
			name: "spoofed own UID cannot bypass actual source denial", fileParent: destination, existingParent: destination,
			configuredID: "configured-folder", existing: []string{"configured-folder"}, wantProbes: []string{"configured-folder"},
			wantNames: []string{"existing-folder"}, wantFolders: []string{destination}, probesAtCheck: []int{1}, denyName: "existing-folder", wantForbidden: true,
		},
		{
			name: "own UID grant does not bypass a different configured folder denial", fileParent: destination, existingParent: destination,
			configuredID: "configured-folder", existing: []string{"configured-folder"}, wantProbes: []string{"configured-folder"},
			wantNames: []string{"existing-folder", "configured-folder"}, wantFolders: []string{destination, "configured-folder"}, probesAtCheck: []int{1, 1},
			denyName: "configured-folder", wantForbidden: true,
		},
		{
			name: "missing repository root is forbidden before permission checks", fileParent: destination, existingParent: destination,
			wantProbes: []string{"existing-folder", destination, parent, cfg.Name}, wantForbidden: true,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			parsed := makeAuthorizeResourceParsed(t, tt.fileParent, tt.existingParent, true)
			parsed.FolderScoped = true
			parsed.GVR = FolderResource
			parsed.Info = &repository.FileInfo{Path: "team/new/child/_folder.json", Ref: "feature"}
			parsed.Obj.SetName("proposed-folder")
			parsed.Existing.SetName("existing-folder")
			reader := repository.NewMockReaderWriter(t)
			reader.EXPECT().Config().Return(cfg).Maybe()
			configuredID := tt.configuredID
			if configuredID == "" {
				configuredID = parsed.Existing.GetName()
			}
			manifest, err := json.Marshal(NewFolderManifest(configuredID, "Child", FolderKind))
			require.NoError(t, err)
			isCaller := mock.MatchedBy(func(readCtx context.Context) bool {
				caller, _ := identity.GetRequester(ctx)
				requester, err := identity.GetRequester(readCtx)
				return err == nil && requester == caller
			})
			reader.EXPECT().Read(isCaller, "team/new/child/_folder.json", "").Return(&repository.FileInfo{Data: manifest}, nil).Once()
			reader.EXPECT().Read(isCaller, "team/new/_folder.json", "").Return(nil, repository.ErrFileNotFound).Maybe()
			reader.EXPECT().Read(isCaller, "team/_folder.json", "").Return(nil, repository.ErrFileNotFound).Maybe()
			folderClient := &MockDynamicResourceInterface{}
			folderClient.Test(t)
			t.Cleanup(func() { folderClient.AssertExpectations(t) })
			var probes, checkedNames []string
			for _, id := range tt.wantProbes {
				var obj *unstructured.Unstructured
				var err error = apierrors.NewNotFound(FolderResource.GroupResource(), id)
				for _, existing := range tt.existing {
					if existing == id {
						obj = newManagedAncestorFolder(t, cfg, id, ancestorPaths[id])
						err = nil
					}
				}
				folderClient.On("Get", mock.Anything, id, metav1.GetOptions{}, []string(nil)).Return(obj, err).
					Run(func(args mock.Arguments) { probes = append(probes, args.String(1)) }).Once()
			}
			clients := NewMockResourceClients(t)
			access := auth.NewMockAccessChecker(t)
			for i, name := range tt.wantNames {
				var checkErr error
				if name == tt.denyName {
					checkErr = denied
				}
				access.On("Check", ctx, authlib.CheckRequest{
					Group: FolderResource.Group, Resource: FolderResource.Resource, Name: name, Verb: utils.VerbGet,
				}, tt.wantFolders[i]).Return(checkErr).Run(func(args mock.Arguments) {
					assert.Len(t, probes, tt.probesAtCheck[i], "folder probes and access checks must retain their order")
					checkedNames = append(checkedNames, args.Get(1).(authlib.CheckRequest).Name)
				}).Once()
			}
			folders := NewFolderManager(reader, folderClient, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))

			err = NewAuthorizer(cfg, reader, access, clients, folders, true).AuthorizeResource(ctx, parsed, utils.VerbGet)
			if tt.wantForbidden {
				require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, tt.wantProbes, probes)
			assert.Equal(t, tt.wantNames, checkedNames)
			assert.Equal(t, tt.fileParent, parsed.Meta.GetFolder())
		})
	}
}

func TestAuthorizeResource_ReadStopsOnWrappedAccessErrors(t *testing.T) {
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
					err := NewAuthorizer(cfg, reader, access, clients, folderManager, false).AuthorizeResource(ctx, parsed, utils.VerbGet)
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
			err := authorizer.AuthorizeDeleteByPath(context.Background(), tt.path)

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
			err := authorizer.AuthorizeMoveByPath(context.Background(), tt.originalPath, tt.targetPath)

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
			err := authorizer.AuthorizeDeleteByPath(context.Background(), tt.folderPath)

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
		err := authorizer.AuthorizeMoveByPath(context.Background(), "source/", "target-parent/moved/")

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
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/dashboard.json")

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
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "dashboard.json")

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
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/")

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
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "restricted/dashboard.json")

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
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "unknown/file.json")

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
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "bad/widget.json")

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
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "sneaky/folder.json")

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
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/dashboard.json")

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
		err := authorizer.AuthorizeMoveByPath(context.Background(), "src/dashboard.json", "dst/dashboard.json")

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
		err := authorizer.AuthorizeMoveByPath(context.Background(), "src-folder/", "dst-folder/")

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
		err := authorizer.AuthorizeMoveByPath(context.Background(), "restricted/dash.json", "dest/dash.json")

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
		err := authorizer.AuthorizeMoveByPath(context.Background(), "src/dash.json", "restricted/dash.json")

		assert.Error(t, err)
	})
}
