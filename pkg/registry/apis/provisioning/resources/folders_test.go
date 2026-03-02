package resources_test

import (
	"context"
	"errors"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
)

func TestPathCreationError(t *testing.T) {
	t.Run("Error method returns formatted message", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &resources.PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		expectedMsg := "failed to create path grafana/folder-1: underlying error"
		require.Equal(t, expectedMsg, pathErr.Error())
	})

	t.Run("Unwrap returns underlying error", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &resources.PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		unwrapped := pathErr.Unwrap()
		require.Equal(t, underlyingErr, unwrapped)
		require.EqualError(t, unwrapped, "underlying error")
	})

	t.Run("errors.Is finds underlying error", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &resources.PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		require.True(t, errors.Is(pathErr, underlyingErr))
		require.False(t, errors.Is(pathErr, fmt.Errorf("different error")))
	})

	t.Run("errors.As extracts PathCreationError", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &resources.PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		var extractedErr *resources.PathCreationError
		require.True(t, errors.As(pathErr, &extractedErr))
		require.NotNil(t, extractedErr)
		require.Equal(t, "grafana/folder-1", extractedErr.Path)
		require.Equal(t, underlyingErr, extractedErr.Err)
	})

	t.Run("errors.As returns false for non-PathCreationError", func(t *testing.T) {
		regularErr := fmt.Errorf("regular error")

		var extractedErr *resources.PathCreationError
		require.False(t, errors.As(regularErr, &extractedErr))
		require.Nil(t, extractedErr)
	})
}

func TestEnsureFolderPathExistWithBeforeCreate(t *testing.T) {
	ctx := context.Background()

	newRepo := func(t *testing.T) (*repository.MockReaderWriter, *provisioning.Repository) {
		cfg := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "repo-a",
				Namespace: "default",
			},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{
					Target: provisioning.SyncTargetTypeFolder,
				},
			},
		}

		repo := repository.NewMockReaderWriter(t)
		repo.On("Config").Return(cfg)
		return repo, cfg
	}

	t.Run("returns path creation error when beforeCreate fails", func(t *testing.T) {
		repo, cfg := newRepo(t)
		tree := resources.NewEmptyFolderTree()
		client := &fakeDynamicResourceClient{}
		hookErr := errors.New("beforeCreate failed")

		var intercepted []string
		fm := resources.NewFolderManager(repo, client, tree, resources.WithBeforeCreate(func(_ context.Context, folder resources.Folder) error {
			intercepted = append(intercepted, folder.Path)
			return hookErr
		}))

		parent, err := fm.EnsureFolderPathExist(ctx, "a/b/dashboard.json")
		require.Error(t, err)
		require.Empty(t, parent)

		var pathErr *resources.PathCreationError
		require.ErrorAs(t, err, &pathErr)
		require.Equal(t, "a", pathErr.Path)
		require.ErrorIs(t, err, hookErr)
		require.Equal(t, []string{"a"}, intercepted)
		require.Empty(t, client.getCalls)
		require.Empty(t, client.createCalls)

		_ = cfg
	})

	t.Run("allows all creations when beforeCreate returns nil", func(t *testing.T) {
		repo, cfg := newRepo(t)
		tree := resources.NewEmptyFolderTree()
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		var intercepted []string
		fm := resources.NewFolderManager(repo, client, tree, resources.WithBeforeCreate(func(_ context.Context, folder resources.Folder) error {
			intercepted = append(intercepted, folder.Path)
			return nil
		}))

		parent, err := fm.EnsureFolderPathExist(ctx, "a/b/c/dashboard.json")
		require.NoError(t, err)

		fA := resources.ParseFolder("a", cfg.GetName())
		fAB := resources.ParseFolder("a/b", cfg.GetName())
		fABC := resources.ParseFolder("a/b/c", cfg.GetName())

		require.Equal(t, fABC.ID, parent)
		require.Equal(t, []string{"a", "a/b", "a/b/c"}, intercepted)
		require.Equal(t, []string{fA.ID, fAB.ID, fABC.ID}, client.getCalls)
		require.Equal(t, []string{fA.ID, fAB.ID, fABC.ID}, client.createCalls)
		require.True(t, tree.In(fA.ID))
		require.True(t, tree.In(fAB.ID))
		require.True(t, tree.In(fABC.ID))
	})

	t.Run("stops in the middle of path walk when beforeCreate fails", func(t *testing.T) {
		repo, cfg := newRepo(t)
		tree := resources.NewEmptyFolderTree()
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		hookErr := errors.New("stop at a/b")
		var intercepted []string
		fm := resources.NewFolderManager(repo, client, tree, resources.WithBeforeCreate(func(_ context.Context, folder resources.Folder) error {
			intercepted = append(intercepted, folder.Path)
			if folder.Path == "a/b" {
				return hookErr
			}
			return nil
		}))

		parent, err := fm.EnsureFolderPathExist(ctx, "a/b/c/dashboard.json")
		require.Error(t, err)
		require.Empty(t, parent)

		var pathErr *resources.PathCreationError
		require.ErrorAs(t, err, &pathErr)
		require.Equal(t, "a/b", pathErr.Path)
		require.ErrorIs(t, err, hookErr)
		require.Equal(t, []string{"a", "a/b"}, intercepted)

		fA := resources.ParseFolder("a", cfg.GetName())
		fAB := resources.ParseFolder("a/b", cfg.GetName())
		fABC := resources.ParseFolder("a/b/c", cfg.GetName())

		require.Equal(t, []string{fA.ID}, client.getCalls)
		require.Equal(t, []string{fA.ID}, client.createCalls)
		require.True(t, tree.In(fA.ID))
		require.False(t, tree.In(fAB.ID))
		require.False(t, tree.In(fABC.ID))
	})

	t.Run("existing folders in tree do not call beforeCreate", func(t *testing.T) {
		repo, cfg := newRepo(t)
		tree := resources.NewEmptyFolderTree()

		fA := resources.ParseFolder("a", cfg.GetName())
		fAB := resources.ParseFolder("a/b", cfg.GetName())
		tree.Add(fA, resources.RootFolder(cfg))
		tree.Add(fAB, fA.ID)

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		var intercepted []string
		fm := resources.NewFolderManager(repo, client, tree, resources.WithBeforeCreate(func(_ context.Context, folder resources.Folder) error {
			intercepted = append(intercepted, folder.Path)
			return nil
		}))

		parent, err := fm.EnsureFolderPathExist(ctx, "a/b/c/dashboard.json")
		require.NoError(t, err)

		fABC := resources.ParseFolder("a/b/c", cfg.GetName())
		require.Equal(t, fABC.ID, parent)
		require.Equal(t, []string{"a/b/c"}, intercepted)
		require.Equal(t, []string{fABC.ID}, client.getCalls)
		require.Equal(t, []string{fABC.ID}, client.createCalls)
	})
}

type fakeDynamicResourceClient struct {
	getFn    func(name string) (*unstructured.Unstructured, error)
	createFn func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error)

	getCalls    []string
	createCalls []string
}

func (f *fakeDynamicResourceClient) Create(_ context.Context, obj *unstructured.Unstructured, _ metav1.CreateOptions, _ ...string) (*unstructured.Unstructured, error) {
	f.createCalls = append(f.createCalls, obj.GetName())
	if f.createFn != nil {
		return f.createFn(obj)
	}
	return obj, nil
}

func (f *fakeDynamicResourceClient) Update(context.Context, *unstructured.Unstructured, metav1.UpdateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("unexpected call to Update")
}

func (f *fakeDynamicResourceClient) UpdateStatus(context.Context, *unstructured.Unstructured, metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	panic("unexpected call to UpdateStatus")
}

func (f *fakeDynamicResourceClient) Delete(context.Context, string, metav1.DeleteOptions, ...string) error {
	panic("unexpected call to Delete")
}

func (f *fakeDynamicResourceClient) DeleteCollection(context.Context, metav1.DeleteOptions, metav1.ListOptions) error {
	panic("unexpected call to DeleteCollection")
}

func (f *fakeDynamicResourceClient) Get(_ context.Context, name string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	f.getCalls = append(f.getCalls, name)
	if f.getFn != nil {
		return f.getFn(name)
	}
	return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
}

func (f *fakeDynamicResourceClient) List(context.Context, metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	panic("unexpected call to List")
}

func (f *fakeDynamicResourceClient) Watch(context.Context, metav1.ListOptions) (watch.Interface, error) {
	panic("unexpected call to Watch")
}

func (f *fakeDynamicResourceClient) Patch(context.Context, string, types.PatchType, []byte, metav1.PatchOptions, ...string) (*unstructured.Unstructured, error) {
	panic("unexpected call to Patch")
}

func (f *fakeDynamicResourceClient) Apply(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions, ...string) (*unstructured.Unstructured, error) {
	panic("unexpected call to Apply")
}

func (f *fakeDynamicResourceClient) ApplyStatus(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	panic("unexpected call to ApplyStatus")
}

var _ dynamic.ResourceInterface = (*fakeDynamicResourceClient)(nil)
