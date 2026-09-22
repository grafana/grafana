package resources

import (
	"context"
	"fmt"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// TestDualReadWriter_ReadNewDashboardPreviewWithTokenAuth exercises previews of new
// dashboards whose folders have not been synced to Grafana. It uses the real parser,
// authorizer, and token checker with mocked storage and ancestor-scoped grants.
// Token auth prevents the Editor role fallback from masking authorization failures.
// The cases cover branch and folder-metadata variants, allowing or denying previews
// according to ancestor permissions while preserving the caller identity and the
// dashboard's destination folder. Preview reads must not persist any changes.
func TestDualReadWriter_ReadNewDashboardPreviewWithTokenAuth(t *testing.T) {
	for _, tt := range []struct {
		name                  string
		path                  string
		ref                   string
		folderMetadata        bool
		metadataOnlyOnFeature bool
		canReadAncestor       bool
	}{
		{name: "feature branch with one missing hash folder", path: "new/dashboard.json", ref: "feature", canReadAncestor: true},
		{name: "feature branch with multiple missing hash folders", path: "new/nested/dashboard.json", ref: "feature", canReadAncestor: true},
		{name: "feature branch with one missing metadata folder", path: "new/dashboard.json", ref: "feature", folderMetadata: true, canReadAncestor: true},
		{name: "feature branch with multiple missing metadata folders", path: "new/nested/dashboard.json", ref: "feature", folderMetadata: true, canReadAncestor: true},
		{name: "folder metadata exists only on feature branch", path: "new/nested/dashboard.json", ref: "feature", folderMetadata: true, metadataOnlyOnFeature: true, canReadAncestor: true},
		{name: "configured branch awaiting sync", path: "new/nested/dashboard.json", ref: "main", folderMetadata: true, canReadAncestor: true},
		{name: "empty ref uses configured branch", path: "new/dashboard.json", canReadAncestor: true},
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
			repo := repository.NewMockReaderWriter(t)
			repo.EXPECT().Config().Return(cfg)
			repo.EXPECT().Read(mock.Anything, tt.path, tt.ref).Return(&repository.FileInfo{
				Path: tt.path,
				Ref:  tt.ref,
				Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":"Dashboard","metadata":{"name":"preview-dashboard"},"spec":{"title":"Preview dashboard"}}`, DashboardKind.GroupVersion().String())),
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
					} else {
						repo.EXPECT().Read(mock.Anything, metadataPath, "").Return(file, nil).Once()
					}
				}
				if destination == "" {
					destination = folderID
					if tt.metadataOnlyOnFeature {
						folders.On("Get", provisioningContext, destination, metav1.GetOptions{}, mock.Anything).
							Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), destination)).Once()
					}
				}
				if tt.metadataOnlyOnFeature {
					folderID = ParseFolder(dir, cfg.Name).ID
				}
				folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
					Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), folderID)).Once()
			}
			folders.On("Get", provisioningContext, cfg.Name, metav1.GetOptions{}, mock.Anything).
				Return(&unstructured.Unstructured{Object: map[string]interface{}{
					"metadata": map[string]interface{}{"name": cfg.Name, "namespace": cfg.Namespace},
				}}, nil).Once()

			dashboards := &MockDynamicResourceInterface{}
			t.Cleanup(func() { dashboards.AssertExpectations(t) })
			dashboards.On("Get", provisioningContext, "preview-dashboard", metav1.GetOptions{}, mock.Anything).
				Return(nil, apierrors.NewNotFound(DashboardResource.GroupResource(), "preview-dashboard")).Once()
			var dryRunObject *unstructured.Unstructured
			dashboards.On("Create", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					dryRunObject = args.Get(1).(*unstructured.Unstructured)
					require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.CreateOptions).DryRun)
				}).Return(&unstructured.Unstructured{}, nil).Once()

			clients := NewMockResourceClients(t)
			clients.EXPECT().ForKind(ctx, DashboardKind).Return(dashboards, DashboardResource, nil).Once()
			clients.EXPECT().SupportedResources().Return(SupportedProvisioningResources).Once()
			clients.EXPECT().Folder(provisioningContext).Return(folders, FolderKind, nil).Once()
			parser := &parser{
				repo: provisioning.ResourceRepositoryInfo{
					Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type,
				},
				reader: repo, config: cfg, clients: clients, folderMetadataEnabled: tt.folderMetadata,
			}
			var checkedFolders []string
			access := auth.NewTokenAccessChecker(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				require.Same(t, ctx, checkCtx)
				require.Same(t, caller, id)
				require.Equal(t, authlib.CheckRequest{
					Namespace: cfg.Namespace, Group: DashboardResource.Group, Resource: DashboardResource.Resource,
					Verb: utils.VerbGet, Name: "preview-dashboard",
				}, req)
				checkedFolders = append(checkedFolders, folder)
				return authlib.CheckResponse{Allowed: tt.canReadAncestor && folder == cfg.Name}, nil
			})).WithFallbackRole(identity.RoleViewer)
			authorizer := NewAuthorizer(cfg, repo, access, clients, tt.folderMetadata)
			readWriter := NewDualReadWriter(repo, parser, nil, authorizer, tt.folderMetadata)

			parsed, err := readWriter.Read(ctx, tt.path, tt.ref)
			if tt.canReadAncestor {
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
			require.NotNil(t, dryRunObject)
			meta, err := utils.MetaAccessor(dryRunObject)
			require.NoError(t, err)
			assert.Equal(t, destination, meta.GetFolder())
			assert.Equal(t, []string{destination, cfg.Name}, checkedFolders)
			assert.Len(t, dashboards.Calls, 2, "preview only gets the dashboard and dry-runs its creation")
			for _, call := range folders.Calls {
				assert.Equal(t, "Get", call.Method, "preview must not create folders")
			}
			for _, call := range repo.Calls {
				assert.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
			}
		})
	}
}

// A successful check against PR metadata must not bypass the configured folder's
// permissions, even when the PR UID names an existing folder the caller can read.
// Missing configured destinations still require permission on a real existing ancestor.
func TestDualReadWriter_ReadNewDashboardPreviewValidatesConfiguredFolder(t *testing.T) {
	for _, tt := range []struct {
		name              string
		path              string
		target            provisioning.SyncTargetType
		folderMetadata    bool
		unsynced          bool
		configuredFolder  string
		canReadConfigured bool
		ancestorExists    bool
		canReadAncestor   bool
		wantAllowed       bool
	}{
		{name: "allowed PR folder cannot bypass denied configured folder", folderMetadata: true, configuredFolder: "restricted-folder"},
		{name: "different allowed configured folder permits preview", folderMetadata: true, configuredFolder: "other-allowed-folder", canReadConfigured: true, wantAllowed: true},
		{name: "matching allowed folder permits preview", folderMetadata: true, configuredFolder: "preview-folder", wantAllowed: true},
		{name: "allowed hash folder before instance sync", target: provisioning.SyncTargetTypeInstance, unsynced: true, canReadConfigured: true},
		{name: "allowed repository root before folder sync", path: "dashboard.json", unsynced: true, canReadConfigured: true},
		{name: "matching allowed metadata folder requires ancestor permission", folderMetadata: true, configuredFolder: "preview-folder", unsynced: true, ancestorExists: true},
		{name: "matching allowed metadata folder inherits from allowed ancestor", folderMetadata: true, configuredFolder: "preview-folder", unsynced: true, ancestorExists: true, canReadAncestor: true, wantAllowed: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			dashboardPath := tt.path
			if dashboardPath == "" {
				dashboardPath = "team/dashboard.json"
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
				destination = ParentFolder(dashboardPath, cfg)
				configuredFolder = destination
			}
			repo := repository.NewMockReaderWriter(t)
			if safepath.Dir(dashboardPath) != "" {
				repo.EXPECT().Config().Return(cfg)
			}
			repo.EXPECT().Read(mock.Anything, dashboardPath, "feature").Return(&repository.FileInfo{
				Path: dashboardPath, Ref: "feature",
				Data: []byte(fmt.Sprintf(`{"apiVersion":%q,"kind":"Dashboard","metadata":{"name":"preview-dashboard"},"spec":{"title":"Preview dashboard"}}`, DashboardKind.GroupVersion().String())),
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
			probedFolderIDs := []string{destination}
			if configuredFolder != destination {
				probedFolderIDs = append(probedFolderIDs, configuredFolder)
			}
			if tt.unsynced && safepath.Dir(dashboardPath) != "" && target == provisioning.SyncTargetTypeFolder {
				probedFolderIDs = append(probedFolderIDs, cfg.Name)
			}
			for _, folderID := range probedFolderIDs {
				folderExists := !tt.unsynced || (folderID == cfg.Name && tt.ancestorExists)
				if !folderExists {
					folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
						Return(nil, apierrors.NewNotFound(FolderResource.GroupResource(), folderID)).Once()
					continue
				}
				folders.On("Get", provisioningContext, folderID, metav1.GetOptions{}, mock.Anything).
					Return(&unstructured.Unstructured{Object: map[string]interface{}{
						"metadata": map[string]interface{}{"name": folderID, "namespace": cfg.Namespace},
					}}, nil).Once()
			}

			dashboards := &MockDynamicResourceInterface{}
			t.Cleanup(func() { dashboards.AssertExpectations(t) })
			dashboards.On("Get", provisioningContext, "preview-dashboard", metav1.GetOptions{}, mock.Anything).
				Return(nil, apierrors.NewNotFound(DashboardResource.GroupResource(), "preview-dashboard")).Once()
			var dryRunObject *unstructured.Unstructured
			dashboards.On("Create", provisioningContext, mock.Anything, mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					dryRunObject = args.Get(1).(*unstructured.Unstructured)
					require.Equal(t, []string{metav1.DryRunAll}, args.Get(2).(metav1.CreateOptions).DryRun)
				}).Return(&unstructured.Unstructured{}, nil).Once()
			clients := NewMockResourceClients(t)
			clients.EXPECT().ForKind(ctx, DashboardKind).Return(dashboards, DashboardResource, nil).Once()
			clients.EXPECT().SupportedResources().Return(SupportedProvisioningResources).Once()
			clients.EXPECT().Folder(provisioningContext).Return(folders, FolderKind, nil).Once()
			parser := &parser{
				repo:   provisioning.ResourceRepositoryInfo{Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type},
				reader: repo, config: cfg, clients: clients, folderMetadataEnabled: tt.folderMetadata,
			}
			var checkedFolders []string
			access := auth.NewTokenAccessChecker(previewTokenAccessChecker(func(checkCtx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				require.Same(t, ctx, checkCtx)
				require.Same(t, caller, id)
				require.Equal(t, authlib.CheckRequest{
					Namespace: cfg.Namespace, Group: DashboardResource.Group, Resource: DashboardResource.Resource,
					Verb: utils.VerbGet, Name: "preview-dashboard",
				}, req)
				checkedFolders = append(checkedFolders, folder)
				allowed := folder == destination ||
					(tt.canReadConfigured && folder == configuredFolder) ||
					(tt.canReadAncestor && folder == cfg.Name)
				return authlib.CheckResponse{Allowed: allowed}, nil
			})).WithFallbackRole(identity.RoleViewer)
			authorizer := NewAuthorizer(cfg, repo, access, clients, tt.folderMetadata)
			readWriter := NewDualReadWriter(repo, parser, nil, authorizer, tt.folderMetadata)

			parsed, err := readWriter.Read(ctx, dashboardPath, "feature")
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
			checkedFolderIDs := []string{destination}
			if configuredFolder != destination {
				checkedFolderIDs = append(checkedFolderIDs, configuredFolder)
			} else if tt.unsynced && tt.ancestorExists {
				checkedFolderIDs = append(checkedFolderIDs, cfg.Name)
			}
			assert.Equal(t, checkedFolderIDs, checkedFolders)
			require.NotNil(t, dryRunObject)
			meta, err := utils.MetaAccessor(dryRunObject)
			require.NoError(t, err)
			assert.Equal(t, destination, meta.GetFolder())
			assert.Len(t, dashboards.Calls, 2, "preview only gets the dashboard and dry-runs its creation")
			for _, call := range folders.Calls {
				assert.Equal(t, "Get", call.Method, "preview must not create folders")
			}
			for _, call := range repo.Calls {
				assert.Contains(t, []string{"Read", "Config"}, call.Method, "preview must not mutate the repository")
			}
		})
	}
}

type previewTokenAccessChecker func(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error)

func (f previewTokenAccessChecker) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return f(ctx, id, req, folder)
}
