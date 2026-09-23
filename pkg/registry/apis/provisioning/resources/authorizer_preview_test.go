package resources

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

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
		lookupErrorID   string
		clientErr       error
		wantProbes      []string
		wantChecks      []string
		wantErr         error
		wantForbidden   bool
	}{
		{
			name: "inherits from the nearest existing parent", existing: []string{teamID}, allowed: teamID,
			wantProbes: []string{newID, teamID}, wantChecks: []string{newID, teamID},
		},
		{
			name: "skips several missing folders", path: "team/new/deep/resource.json", destination: deepID,
			existing: []string{teamID}, allowed: teamID,
			wantProbes: []string{deepID, newID, teamID}, wantChecks: []string{deepID, teamID},
		},
		{
			name: "inherits from the existing repository root", existing: []string{repoName}, allowed: repoName,
			wantProbes: []string{newID, teamID, repoName}, wantChecks: []string{newID, repoName},
		},
		{
			name: "denied nearest ancestor stops before an allowed root", existing: []string{teamID, repoName}, allowed: repoName,
			wantProbes: []string{newID, teamID}, wantChecks: []string{newID, teamID}, wantErr: denied,
		},
		{
			name: "existing destination denial is authoritative", existing: []string{newID, teamID}, allowed: teamID,
			wantProbes: []string{newID}, wantChecks: []string{newID}, wantErr: denied,
		},
		{
			name: "PR UID cannot bypass the configured directory", destination: "pr-controlled-uid",
			metadataEnabled: true, metadata: metadata, existing: []string{"configured-folder", teamID}, allowed: teamID,
			wantProbes: []string{"pr-controlled-uid", "configured-folder"},
			wantChecks: []string{"pr-controlled-uid", "configured-folder"}, wantErr: denied,
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
			wantProbes: []string{"pr-controlled-uid", "configured-folder"}, wantChecks: []string{"pr-controlled-uid", "configured-folder"},
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
			existing: []string{teamID}, allowed: teamID, wantProbes: []string{newID, teamID}, wantChecks: []string{newID, teamID},
		},
		{
			name: "missing repository root preserves denial", allowed: repoName,
			wantProbes: []string{newID, teamID, repoName}, wantChecks: []string{newID}, wantErr: denied,
		},
		{
			name: "instance repository can use a real ancestor", target: provisioning.SyncTargetTypeInstance,
			existing: []string{teamID}, allowed: teamID, wantProbes: []string{newID, teamID}, wantChecks: []string{newID, teamID},
		},
		{
			name: "instance repository cannot substitute General", target: provisioning.SyncTargetTypeInstance,
			wantProbes: []string{newID, teamID}, wantChecks: []string{newID}, wantErr: denied,
		},
		{
			name: "allowed missing destination inherits from an allowed ancestor", existing: []string{teamID},
			allowed: newID, alsoAllowed: teamID, wantProbes: []string{newID, teamID}, wantChecks: []string{newID, teamID},
		},
		{
			name: "allowed missing destination still requires ancestor permission", existing: []string{teamID}, allowed: newID,
			wantProbes: []string{newID, teamID}, wantChecks: []string{newID, teamID}, wantErr: denied,
		},
		{
			name: "allowed missing destination cannot authorize a missing repository root", allowed: newID,
			wantProbes: []string{newID, teamID, repoName}, wantChecks: []string{newID}, wantForbidden: true,
		},
		{
			name: "allowed missing destination cannot substitute General", target: provisioning.SyncTargetTypeInstance, allowed: newID,
			wantProbes: []string{newID, teamID}, wantChecks: []string{newID}, wantForbidden: true,
		},
		{
			name: "allowed missing configured UID still requires an ancestor", destination: "configured-folder",
			metadataEnabled: true, metadata: metadata, allowed: "configured-folder",
			wantProbes: []string{"configured-folder", teamID, repoName}, wantChecks: []string{"configured-folder"}, wantForbidden: true,
		},
		{
			name: "allowed missing repository root is denied", path: "resource.json", destination: repoName, allowed: repoName,
			wantProbes: []string{repoName}, wantChecks: []string{repoName}, wantForbidden: true,
		},
		{
			name: "allowed PR UID cannot authorize a missing repository root", destination: "pr-controlled-uid", allowed: "pr-controlled-uid",
			wantProbes: []string{"pr-controlled-uid", newID, teamID, repoName}, wantChecks: []string{"pr-controlled-uid"}, wantForbidden: true,
		},
		{
			name: "allowed PR UID cannot substitute General", destination: "pr-controlled-uid", allowed: "pr-controlled-uid",
			target:     provisioning.SyncTargetTypeInstance,
			wantProbes: []string{"pr-controlled-uid", newID, teamID}, wantChecks: []string{"pr-controlled-uid"}, wantForbidden: true,
		},
		{
			name: "folder client errors propagate", clientErr: lookupErr, wantChecks: []string{newID}, wantErr: lookupErr,
		},
		{
			name: "destination lookup errors propagate", lookupErrorID: newID,
			wantProbes: []string{newID}, wantChecks: []string{newID}, wantErr: lookupErr,
		},
		{
			name: "ancestor lookup errors propagate", lookupErrorID: teamID,
			wantProbes: []string{newID, teamID}, wantChecks: []string{newID}, wantErr: lookupErr,
		},
		{
			name: "allowed destination lookup errors propagate", allowed: newID, lookupErrorID: newID,
			wantProbes: []string{newID}, wantChecks: []string{newID}, wantErr: lookupErr,
		},
		{
			name: "metadata lookup errors propagate", metadataEnabled: true, metadataErr: readErr,
			wantProbes: []string{newID}, wantChecks: []string{newID}, wantErr: readErr,
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
			wantProbes: []string{newID}, wantChecks: []string{newID}, wantErr: ErrInvalidFolderMetadata,
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
				name := parsed.Obj.GetName()
				if gvr.GroupResource() == FolderResource.GroupResource() {
					name = id
				}
				access.On("Check", ctx, authlib.CheckRequest{
					Group: parsed.GVR.Group, Resource: parsed.GVR.Resource, Name: name, Verb: utils.VerbGet,
				}, id).Return(accessErr).Run(func(args mock.Arguments) {
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
		name     string
		verb     string
		eligible bool
		result   error
		modify   func(*ParsedResource)
	}{
		{name: "successful existing resource check", verb: utils.VerbGet, modify: func(p *ParsedResource) { p.Existing = p.Obj.DeepCopy() }},
		{name: "non-forbidden failure", verb: utils.VerbGet, eligible: true, result: assert.AnError},
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
			assert.Equal(t, tt.eligible, isNewResourcePreview(parsed, tt.verb))
			name := parsed.Obj.GetName()
			if tt.eligible && gvr.GroupResource() == FolderResource.GroupResource() {
				name = parsed.Meta.GetFolder()
			}
			access := auth.NewMockAccessChecker(t)
			access.On("Check", mock.Anything, authlib.CheckRequest{
				Group: parsed.GVR.Group, Resource: parsed.GVR.Resource, Name: name, Verb: tt.verb,
			}, parsed.Meta.GetFolder()).Return(tt.result).Once()
			clients := NewMockResourceClients(t)
			reader := repository.NewMockReaderWriter(t)
			err = NewAuthorizer(&provisioning.Repository{}, reader, access, clients, true).
				AuthorizeResource(context.Background(), parsed, tt.verb)
			assert.Equal(t, tt.result, err)
		})
	}
}
