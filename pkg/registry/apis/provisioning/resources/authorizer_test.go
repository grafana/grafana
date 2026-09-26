package resources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

		err := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false).AuthorizeResource(context.Background(), parsed, utils.VerbCreate)
		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("same-folder update runs single check", func(t *testing.T) {
		parsed := makeAuthorizeResourceParsed(t, "folder-a", "folder-a", true)
		mockAccess := auth.NewMockAccessChecker(t)
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), "folder-a").Return(nil).Once()

		err := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false).AuthorizeResource(context.Background(), parsed, utils.VerbUpdate)
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

		err := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false).AuthorizeResource(context.Background(), parsed, utils.VerbUpdate)
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

		err := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false).AuthorizeResource(context.Background(), parsed, utils.VerbUpdate)
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

		err := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false).AuthorizeResource(context.Background(), parsed, utils.VerbUpdate)
		assert.Error(t, err)
		mockAccess.AssertExpectations(t)
	})
}

func TestAuthorizeResource_NewResourcePreview(t *testing.T) {
	for _, gvr := range []schema.GroupVersionResource{
		DashboardResource,
		DashboardResourceV2beta1,
		dashboard.LibraryPanelResourceInfo.GroupVersionResource(),
		FolderResource,
		{Group: "example.grafana.app", Version: "v1alpha1", Resource: "widgets"},
	} {
		t.Run(gvr.Resource+"/"+gvr.Version, func(t *testing.T) {
			testAuthorizeNewResourcePreview(t, gvr)
		})
	}
}

func testAuthorizeNewResourcePreview(t *testing.T, gvr schema.GroupVersionResource) {
	t.Helper()
	const repoName = "preview-repo"
	teamID := ParseFolder("team/", repoName).ID
	newID := ParseFolder("team/new/", repoName).ID
	deepID := ParseFolder("team/new/deep/", repoName).ID
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
		clientErr       error
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
			wantProbes: []string{"pr-controlled-uid", "configured-folder"},
			wantChecks: []string{"configured-folder"}, wantErr: denied,
		},
		{
			name: "allowed PR UID cannot bypass the configured directory", destination: "pr-controlled-uid",
			metadataEnabled: true, metadata: metadata, existing: []string{"pr-controlled-uid", "configured-folder"}, allowed: "pr-controlled-uid",
			wantProbes: []string{"pr-controlled-uid", "configured-folder"},
			wantChecks: []string{"pr-controlled-uid", "configured-folder"}, wantErr: denied,
		},
		{
			name: "configured folder UID authorizes the immediate directory", destination: "pr-controlled-uid",
			metadataEnabled: true, metadata: metadata, existing: []string{"configured-folder"}, allowed: "configured-folder",
			wantProbes: []string{"pr-controlled-uid", "configured-folder"}, wantChecks: []string{"configured-folder"},
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
			name: "instance repository cannot substitute General", target: provisioning.SyncTargetTypeInstance,
			wantProbes: []string{newID, teamID}, wantForbidden: true,
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
			name: "allowed missing destination cannot substitute General", target: provisioning.SyncTargetTypeInstance, allowed: newID,
			wantProbes: []string{newID, teamID}, wantForbidden: true,
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
			wantProbes: []string{"pr-controlled-uid", newID, teamID, repoName}, wantForbidden: true,
		},
		{
			name: "allowed PR UID cannot substitute General", destination: "pr-controlled-uid", allowed: "pr-controlled-uid",
			target:     provisioning.SyncTargetTypeInstance,
			wantProbes: []string{"pr-controlled-uid", newID, teamID}, wantForbidden: true,
		},
		{
			name: "folder client errors propagate", clientErr: lookupErr, wantErr: lookupErr,
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
			wantProbes: []string{newID}, wantErr: readErr,
		},
		{
			name: "allowed destination still propagates metadata lookup errors", existing: []string{newID}, allowed: newID,
			metadataEnabled: true, metadataErr: readErr,
			wantProbes: []string{newID}, wantChecks: []string{newID}, wantErr: readErr,
		},
		{
			name: "allowed destination cannot bypass malformed configured metadata", existing: []string{newID}, allowed: newID,
			metadataEnabled: true, metadata: []byte("{invalid"),
			wantProbes: []string{newID}, wantChecks: []string{newID}, wantErr: ErrInvalidFolderMetadata,
		},
		{
			name: "malformed configured metadata prevents fallback", metadataEnabled: true, metadata: []byte("{invalid"),
			wantProbes: []string{newID}, wantErr: ErrInvalidFolderMetadata,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
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
			parsed := makeAuthorizeResourceParsed(t, destination, "", false)
			parsed.Obj.SetName("test-resource")
			parsed.FolderScoped = true
			parsed.GVR = gvr
			parsed.Info = &repository.FileInfo{Path: tt.path, Ref: "feature-branch"}
			if parsed.Info.Path == "" {
				parsed.Info.Path = "team/new/resource.json"
			}
			original := parsed.Obj.DeepCopy()
			reader := repository.NewMockReaderWriter(t)
			reader.On("Config").Return(cfg).Maybe()
			if tt.metadataEnabled {
				reader.EXPECT().Read(mock.Anything, mock.Anything, "").RunAndReturn(func(readCtx context.Context, path, _ string) (*repository.FileInfo, error) {
					id, err := identity.GetRequester(readCtx)
					require.NoError(t, err)
					require.Same(t, caller, id)
					if path == "team/new/_folder.json" {
						if tt.metadataErr != nil {
							return nil, tt.metadataErr
						}
						if tt.metadata != nil {
							return &repository.FileInfo{Path: path, Data: tt.metadata}, nil
						}
					}
					return nil, repository.ErrFileNotFound
				}).Maybe()
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
						obj = &unstructured.Unstructured{}
						obj.SetName(id)
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
			clients.EXPECT().Folder(isProvisioning).Return(folderClient, FolderKind, tt.clientErr).Once()
			access := auth.NewMockAccessChecker(t)
			for _, id := range tt.wantChecks {
				var accessErr error = denied
				if id == tt.allowed || id == tt.alsoAllowed {
					accessErr = nil
				}
				if id == tt.accessErrorID {
					accessErr = tt.accessErr
				}
				name := parsed.Obj.GetName()
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

			err := NewAuthorizer(cfg, reader, access, clients, tt.metadataEnabled).AuthorizeResource(ctx, parsed, utils.VerbGet)
			if tt.wantForbidden {
				require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
			} else if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, tt.wantProbes, probes)
			assert.Equal(t, tt.wantChecks, checks)
			assert.Equal(t, original, parsed.Obj)
			assert.Equal(t, destination, parsed.Meta.GetFolder())
		})
	}
}

func TestAuthorizeResource_PreviewFallbackEligibility(t *testing.T) {
	for _, gvr := range []schema.GroupVersionResource{
		DashboardResource,
		dashboard.LibraryPanelResourceInfo.GroupVersionResource(),
		FolderResource,
		{Group: "example.grafana.app", Version: "v1alpha1", Resource: "widgets"},
	} {
		t.Run(gvr.Resource, func(t *testing.T) {
			testPreviewFallbackEligibility(t, gvr)
		})
	}
}

func testPreviewFallbackEligibility(t *testing.T, gvr schema.GroupVersionResource) {
	t.Helper()
	denied := apierrors.NewForbidden(gvr.GroupResource(), "test-resource", errors.New("no read permission"))
	tests := []struct {
		name   string
		verb   string
		result error
		modify func(*ParsedResource)
	}{
		{name: "successful existing resource check", verb: utils.VerbGet, modify: func(p *ParsedResource) { p.Existing = p.Obj.DeepCopy() }},
		{name: "existing resource access error", verb: utils.VerbGet, result: assert.AnError, modify: func(p *ParsedResource) { p.Existing = p.Obj.DeepCopy() }},
		{name: "existing resource", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Existing = p.Obj.DeepCopy() }},
		{name: "create", verb: utils.VerbCreate, result: denied},
		{name: "update", verb: utils.VerbUpdate, result: denied},
		{name: "delete", verb: utils.VerbDelete, result: denied},
		{name: "not folder scoped", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.FolderScoped = false }},
		{name: "successful org-scoped preview", verb: utils.VerbGet, modify: func(p *ParsedResource) {
			p.FolderScoped = false
			p.Meta.SetFolder("")
		}},
		{name: "missing source", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Info = nil }},
		{name: "empty source path", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Info.Path = "" }},
		{name: "traversal", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Info.Path = "../resource.json" }},
		{name: "absolute path", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Info.Path = "/resource.json" }},
		{name: "directory", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Info.Path = "team/new/" }},
		{name: "missing destination", verb: utils.VerbGet, result: denied, modify: func(p *ParsedResource) { p.Meta.SetFolder("") }},
		{name: "successful root preview", verb: utils.VerbGet, modify: func(p *ParsedResource) { p.Meta.SetFolder("") }},
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
			assert.False(t, isNewResourcePreview(parsed, tt.verb))
			access := auth.NewMockAccessChecker(t)
			access.On("Check", mock.Anything, authlib.CheckRequest{
				Group: parsed.GVR.Group, Resource: parsed.GVR.Resource, Name: parsed.Obj.GetName(), Verb: tt.verb,
			}, parsed.Meta.GetFolder()).Return(tt.result).Once()
			clients := NewMockResourceClients(t)
			reader := repository.NewMockReaderWriter(t)
			err = NewAuthorizer(&provisioning.Repository{}, reader, access, clients, true).
				AuthorizeResource(context.Background(), parsed, tt.verb)
			assert.Equal(t, tt.result, err)
		})
	}
}

func TestAuthorizeResource_PreviewStopsOnWrappedAccessErrors(t *testing.T) {
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
				accessErr         error
			}{
				{name: "existing destination denied", destinationExists: true},
				{name: "existing destination service error", destinationExists: true, accessErr: serviceErr},
				{name: "nearest ancestor denied"},
				{name: "nearest ancestor service error", accessErr: serviceErr},
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
					parsed := makeAuthorizeResourceParsed(t, destination, "", false)
					parsed.FolderScoped = true
					parsed.Info = &repository.FileInfo{Path: "team/new/resource.json", Ref: "feature"}
					reader := repository.NewMockReaderWriter(t)
					reader.EXPECT().Config().Return(cfg).Maybe()

					isProvisioning := mock.MatchedBy(func(ctx context.Context) bool {
						id, err := identity.GetRequester(ctx)
						return err == nil && identity.IsProvisioningServiceIdentity(id) && id.GetNamespace() == cfg.Namespace
					})
					folders := &MockDynamicResourceInterface{}
					folders.Test(t)
					t.Cleanup(func() { folders.AssertExpectations(t) })
					var probed []string
					for _, id := range []string{destination, parent, cfg.Name} {
						obj := &unstructured.Unstructured{}
						obj.SetName(id)
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
					clients.EXPECT().Folder(isProvisioning).Return(folders, FolderKind, nil).Once()

					checkedFolder := parent
					wantProbes := []string{destination, parent}
					if tt.destinationExists {
						checkedFolder = destination
						wantProbes = []string{destination}
					}
					var checked []string
					access := checker.new(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
						require.Same(t, ctx, checkCtx)
						require.Same(t, caller, id)
						require.Equal(t, authlib.CheckRequest{
							Namespace: cfg.Namespace, Group: parsed.GVR.Group, Resource: parsed.GVR.Resource,
							Name: parsed.Obj.GetName(), Verb: utils.VerbGet,
						}, req)
						checked = append(checked, folder)
						if folder == checkedFolder {
							return authlib.CheckResponse{Allowed: false}, tt.accessErr
						}
						return authlib.CheckResponse{Allowed: true}, nil
					}))

					err := NewAuthorizer(cfg, reader, access, clients, false).AuthorizeResource(ctx, parsed, utils.VerbGet)
					require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
					if tt.accessErr != nil {
						assert.ErrorContains(t, err, serviceErr.Error())
					}
					assert.Equal(t, []string{checkedFolder}, checked, "only the first real folder may be authorized")
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

			authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false)
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

			authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
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

			authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
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

			authorizer := NewAuthorizer(repo, reader, mockAccess, authTestClients(t), true) // folderMetadataEnabled=true
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

			authorizer := NewAuthorizer(repo, reader, mockAccess, authTestClients(t), true)
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

		authorizer := NewAuthorizer(repo, rw, mockAccess, authTestClients(t), true)
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

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, nil, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, rw, mockAccess, authTestClients(t), true)
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

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
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

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, authTestClients(t), false)
		err := authorizer.AuthorizeMoveByPath(context.Background(), "src/dash.json", "restricted/dash.json")

		assert.Error(t, err)
	})
}
