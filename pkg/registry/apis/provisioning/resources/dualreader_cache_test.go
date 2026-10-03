package resources

import (
	"context"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/hash"
	"github.com/grafana/nanogit/storage"
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

func TestDualReadWriter_ReadSharesGitCacheWithinRequest(t *testing.T) {
	for _, inheritedCache := range []bool{false, true} {
		name := "without caller cache"
		if inheritedCache {
			name = "with caller cache"
		}
		t.Run(name, func(t *testing.T) {
			cfg := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "cached-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
					Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
				},
			}
			caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: cfg.Namespace}
			type contextKey struct{}
			ctx := context.WithValue(authlib.WithAuthInfo(context.Background(), caller), contextKey{}, "request value")
			ctx, cancel := context.WithTimeout(ctx, time.Minute)
			defer cancel()
			deadline, _ := ctx.Deadline()
			_, provisioningID, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
			require.NoError(t, err)

			object := &protocol.PackfileObject{
				Hash: hash.MustFromHex("0123456789012345678901234567890123456789"),
				Type: protocol.ObjectTypeTree,
				Data: []byte("shared tree"),
			}
			var callerCache storage.PackfileStorage
			if inheritedCache {
				callerCache = storage.NewInMemoryStorage(ctx)
				callerCache.Add(object)
				ctx = storage.ToContext(ctx, callerCache)
			}

			var caches []storage.PackfileStorage
			var contexts []context.Context
			checkContext := func(checkCtx context.Context, privileged bool) {
				t.Helper()
				cache := storage.FromContext(checkCtx)
				require.Same(t, caches[len(caches)-1], cache)
				cached, ok := cache.Get(object.Hash)
				require.True(t, ok, "later read stages can reuse Git objects from the first read")
				require.Same(t, object, cached)
				require.Equal(t, "request value", checkCtx.Value(contextKey{}))
				gotDeadline, ok := checkCtx.Deadline()
				require.True(t, ok)
				require.Equal(t, deadline, gotDeadline)
				id, ok := authlib.AuthInfoFrom(checkCtx)
				require.True(t, ok)
				if privileged {
					require.Equal(t, provisioningID.GetUID(), id.GetUID())
				} else {
					require.Same(t, caller, id)
				}
				contexts = append(contexts, checkCtx)
			}
			checkPrivilegedContext := func(args mock.Arguments) {
				checkContext(args.Get(0).(context.Context), true)
			}

			repo := repository.NewMockReaderWriter(t)
			repo.EXPECT().Config().Return(cfg)
			repo.EXPECT().Read(mock.Anything, "team/dashboard.json", "feature").
				RunAndReturn(func(readCtx context.Context, path, ref string) (*repository.FileInfo, error) {
					cache := storage.FromContext(readCtx)
					require.NotNil(t, cache)
					require.Zero(t, cache.Len(), "each Read starts with an empty, isolated cache")
					if callerCache != nil {
						require.NotSame(t, callerCache, cache)
					}
					for _, previous := range caches {
						require.NotSame(t, previous, cache)
					}
					caches = append(caches, cache)
					cache.Add(object)
					checkContext(readCtx, false)
					return &repository.FileInfo{
						Path: path, Ref: ref,
						Data: []byte(`{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"Dashboard","metadata":{"name":"cached-dashboard"},"spec":{"title":"Cached dashboard"}}`),
					}, nil
				}).Twice()
			for _, ref := range []string{"feature", ""} {
				repo.EXPECT().Read(mock.Anything, "team/_folder.json", ref).
					Run(func(readCtx context.Context, _, _ string) { checkContext(readCtx, false) }).
					Return(&repository.FileInfo{Data: []byte(`{"metadata":{"name":"team-folder"}}`)}, nil).Twice()
			}

			resource := dashboard.DashboardResourceInfo.GroupVersionResource()
			resourceClient := &MockDynamicResourceInterface{}
			t.Cleanup(func() { resourceClient.AssertExpectations(t) })
			resourceClient.On("Get", mock.Anything, "cached-dashboard", metav1.GetOptions{}, mock.Anything).
				Run(checkPrivilegedContext).Return(nil, apierrors.NewNotFound(resource.GroupResource(), "cached-dashboard")).Twice()
			resourceClient.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				Run(checkPrivilegedContext).Return(&unstructured.Unstructured{}, nil).Twice()
			folders := &MockDynamicResourceInterface{}
			t.Cleanup(func() { folders.AssertExpectations(t) })
			folders.On("Get", mock.Anything, "team-folder", metav1.GetOptions{}, mock.Anything).
				Run(checkPrivilegedContext).Return(newManagedAncestorFolder(t, cfg, "team-folder", "team/"), nil).Twice()

			clients := NewMockResourceClients(t)
			clients.EXPECT().ForKind(mock.Anything, dashboard.DashboardResourceInfo.GroupVersionKind()).
				RunAndReturn(func(parseCtx context.Context, _ schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error) {
					checkContext(parseCtx, false)
					return resourceClient, resource, nil
				}).Twice()
			clients.EXPECT().SupportedResources().Return(SupportedProvisioningResources).Twice()
			parser := &parser{
				repo:   provisioning.ResourceRepositoryInfo{Name: cfg.Name, Namespace: cfg.Namespace, Type: cfg.Spec.Type},
				reader: repo, config: cfg, clients: clients, folderMetadataEnabled: true,
			}
			access := auth.NewMockAccessChecker(t)
			access.EXPECT().Check(mock.Anything, authlib.CheckRequest{
				Group: resource.Group, Resource: resource.Resource, Name: "cached-dashboard", Verb: utils.VerbGet,
			}, "team-folder").Run(func(authCtx context.Context, _ authlib.CheckRequest, _ string) {
				checkContext(authCtx, false)
			}).Return(nil).Twice()
			fm := NewFolderManager(repo, folders, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
			authorizer := NewAuthorizer(cfg, repo, access, clients, fm, true)
			readWriter := NewDualReadWriter(repo, parser, fm, authorizer, true)

			for range 2 {
				_, err := readWriter.Read(ctx, "team/dashboard.json", "feature")
				require.NoError(t, err)
			}
			require.Len(t, caches, 2)
			if callerCache != nil {
				require.Same(t, callerCache, storage.FromContext(ctx))
				require.Equal(t, 1, callerCache.Len())
			} else {
				require.Nil(t, storage.FromContext(ctx))
			}
			cancel()
			for _, checkCtx := range contexts {
				require.ErrorIs(t, checkCtx.Err(), context.Canceled)
			}
		})
	}
}
