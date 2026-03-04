package resources

import (
	"context"
	"errors"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
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
		pathErr := &PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		expectedMsg := "failed to create path grafana/folder-1: underlying error"
		require.Equal(t, expectedMsg, pathErr.Error())
	})

	t.Run("Unwrap returns underlying error", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		unwrapped := pathErr.Unwrap()
		require.Equal(t, underlyingErr, unwrapped)
		require.EqualError(t, unwrapped, "underlying error")
	})

	t.Run("errors.Is finds underlying error", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		require.True(t, errors.Is(pathErr, underlyingErr))
		require.False(t, errors.Is(pathErr, fmt.Errorf("different error")))
	})

	t.Run("errors.As extracts PathCreationError", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		var extractedErr *PathCreationError
		require.True(t, errors.As(pathErr, &extractedErr))
		require.NotNil(t, extractedErr)
		require.Equal(t, "grafana/folder-1", extractedErr.Path)
		require.Equal(t, underlyingErr, extractedErr.Err)
	})

	t.Run("errors.As returns false for non-PathCreationError", func(t *testing.T) {
		regularErr := fmt.Errorf("regular error")

		var extractedErr *PathCreationError
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

		fA := resources.ParseFolder("a", cfg.GetName())

		var pathErr *resources.PathCreationError
		require.ErrorAs(t, err, &pathErr)
		require.Equal(t, "a", pathErr.Path)
		require.ErrorIs(t, err, hookErr)
		require.Equal(t, []string{"a"}, intercepted)
		require.Equal(t, []string{fA.ID}, client.getCalls)
		require.Empty(t, client.createCalls)
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

		require.Equal(t, []string{fA.ID, fAB.ID}, client.getCalls)
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

func TestEnsureFolderExists_TitleUpdate(t *testing.T) {
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

	managedFolder := func(name, title, managerIdentity string) *unstructured.Unstructured {
		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name":      name,
					"namespace": "default",
					"annotations": map[string]interface{}{
						"grafana.app/managerId": managerIdentity,
					},
				},
				"spec": map[string]interface{}{
					"title": title,
				},
			},
		}
		return obj
	}

	t.Run("does not update when title is the same", func(t *testing.T) {
		repo, cfg := newRepo(t)
		tree := resources.NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Same Title", cfg.Name), nil
			},
		}

		fm := resources.NewFolderManager(repo, client, tree)
		err := fm.EnsureFolderExists(ctx, resources.Folder{
			ID:    "folder-id",
			Title: "Same Title",
			Path:  "",
		}, "")

		require.NoError(t, err)
		require.Equal(t, []string{"folder-id"}, client.getCalls)
		require.Empty(t, client.updateCalls, "should not call update when title is unchanged")
	})

	t.Run("updates title when it has changed", func(t *testing.T) {
		repo, cfg := newRepo(t)
		tree := resources.NewEmptyFolderTree()

		var updatedObj *unstructured.Unstructured
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Title", cfg.Name), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				updatedObj = obj.DeepCopy()
				return obj, nil
			},
		}

		fm := resources.NewFolderManager(repo, client, tree)
		err := fm.EnsureFolderExists(ctx, resources.Folder{
			ID:    "folder-id",
			Title: "New Title",
			Path:  "",
		}, "")

		require.NoError(t, err)
		require.Equal(t, []string{"folder-id"}, client.getCalls)
		require.Equal(t, []string{"folder-id"}, client.updateCalls)

		newTitle, _, _ := unstructured.NestedString(updatedObj.Object, "spec", "title")
		require.Equal(t, "New Title", newTitle, "the updated object should have the new title")
	})

	t.Run("returns error when update fails", func(t *testing.T) {
		repo, cfg := newRepo(t)
		tree := resources.NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Title", cfg.Name), nil
			},
			updateFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return nil, fmt.Errorf("conflict")
			},
		}

		fm := resources.NewFolderManager(repo, client, tree)
		err := fm.EnsureFolderExists(ctx, resources.Folder{
			ID:    "folder-id",
			Title: "New Title",
			Path:  "",
		}, "")

		require.Error(t, err)
		require.ErrorContains(t, err, "update folder title")
		require.Equal(t, []string{"folder-id"}, client.updateCalls)
	})

	t.Run("errors when folder is not managed by a repository", func(t *testing.T) {
		repo, _ := newRepo(t)
		tree := resources.NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				obj := &unstructured.Unstructured{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name":        name,
							"annotations": map[string]interface{}{},
						},
						"spec": map[string]interface{}{
							"title": "Some Title",
						},
					},
				}
				return obj, nil
			},
		}

		fm := resources.NewFolderManager(repo, client, tree)
		err := fm.EnsureFolderExists(ctx, resources.Folder{
			ID:    "folder-id",
			Title: "New Title",
			Path:  "",
		}, "")

		require.Error(t, err)
		require.ErrorContains(t, err, "not managed by a repository")
		require.Empty(t, client.updateCalls)
	})

	t.Run("errors when folder is managed by a different repository", func(t *testing.T) {
		repo, _ := newRepo(t)
		tree := resources.NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Title", "other-repo"), nil
			},
		}

		fm := resources.NewFolderManager(repo, client, tree)
		err := fm.EnsureFolderExists(ctx, resources.Folder{
			ID:    "folder-id",
			Title: "New Title",
			Path:  "",
		}, "")

		require.Error(t, err)
		require.ErrorContains(t, err, "managed by a different repository (other-repo)")
		require.Empty(t, client.updateCalls)
	})
}

type fakeDynamicResourceClient struct {
	getFn    func(name string) (*unstructured.Unstructured, error)
	createFn func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error)
	updateFn func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error)

	getCalls    []string
	createCalls []string
	updateCalls []string
}

func (f *fakeDynamicResourceClient) Create(_ context.Context, obj *unstructured.Unstructured, _ metav1.CreateOptions, _ ...string) (*unstructured.Unstructured, error) {
	f.createCalls = append(f.createCalls, obj.GetName())
	if f.createFn != nil {
		return f.createFn(obj)
	}
	return obj, nil
}

func (f *fakeDynamicResourceClient) Update(_ context.Context, obj *unstructured.Unstructured, _ metav1.UpdateOptions, _ ...string) (*unstructured.Unstructured, error) {
	f.updateCalls = append(f.updateCalls, obj.GetName())
	if f.updateFn != nil {
		return f.updateFn(obj)
	}
	return obj, nil
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

func TestEffectiveFolderID(t *testing.T) {
	const hashID = "hash-derived-uid"
	const stableUID = "stable-uid-from-folder-json"

	// Build valid _folder.json data.
	manifest := NewFolderManifest(stableUID, "my-folder")
	validData, err := json.Marshal(manifest)
	require.NoError(t, err)

	t.Run("flag off returns hashID without reading repo", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		// No expectations: effectiveFolderID must not call Config() or Read() when flag is off.

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), false)
		result := fm.effectiveFolderID(context.Background(), "my-folder/", hashID)

		assert.Equal(t, hashID, result)
		rw.AssertNotCalled(t, "Read", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("flag on and valid _folder.json returns stable UID", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: validData}, nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), true)
		result := fm.effectiveFolderID(context.Background(), "my-folder/", hashID)

		assert.Equal(t, stableUID, result)
	})

	t.Run("flag on and read error falls back to hashID", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(nil, errors.New("file not found"))

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), true)
		result := fm.effectiveFolderID(context.Background(), "my-folder/", hashID)

		assert.Equal(t, hashID, result)
	})

	t.Run("flag on and invalid JSON falls back to hashID", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte("not-json")}, nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), true)
		result := fm.effectiveFolderID(context.Background(), "my-folder/", hashID)

		assert.Equal(t, hashID, result)
	})
}

func TestCreateFolderWithUID(t *testing.T) {
	t.Run("top-level folder (no parent)", func(t *testing.T) {
		ctx := context.Background()
		const stableUID = "my-top-level-uid"

		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		mockClient := &MockDynamicResourceInterface{}
		// EnsureFolderExists: Get returns NotFound, then Create succeeds.
		mockClient.On("Get", mock.Anything, stableUID, metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, stableUID))
		mockClient.On("Create", mock.Anything, mock.Anything, metav1.CreateOptions{}, []string(nil)).
			Return(nil, nil)

		fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), false)
		err := fm.CreateFolderWithUID(ctx, "myfolder/", stableUID)

		require.NoError(t, err)
		mockClient.AssertExpectations(t)
	})

	t.Run("nested folder with parent already in tree", func(t *testing.T) {
		ctx := context.Background()
		const stableUID = "child-stable-uid"

		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		// Pre-populate tree with the parent's hash-derived ID so EnsureFolderPathExist
		// finds it immediately without needing to create it.
		tree := NewEmptyFolderTree()
		parentFolder := ParseFolder("parent/", config.Name)
		tree.Add(parentFolder, "")

		mockClient := &MockDynamicResourceInterface{}
		// EnsureFolderExists for child only: Get returns NotFound, then Create succeeds.
		mockClient.On("Get", mock.Anything, stableUID, metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, stableUID))
		mockClient.On("Create", mock.Anything, mock.Anything, metav1.CreateOptions{}, []string(nil)).
			Return(nil, nil)

		fm := NewFolderManager(rw, mockClient, tree, false)
		err := fm.CreateFolderWithUID(ctx, "parent/child/", stableUID)

		require.NoError(t, err)
		mockClient.AssertExpectations(t)
	})

	t.Run("nested folder where parent needs to be created", func(t *testing.T) {
		ctx := context.Background()
		const stableUID = "child-stable-uid"

		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		parentFolder := ParseFolder("parent/", config.Name)

		mockClient := &MockDynamicResourceInterface{}
		// EnsureFolderExists for parent: Get returns NotFound, then Create succeeds.
		mockClient.On("Get", mock.Anything, parentFolder.ID, metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, parentFolder.ID))
		mockClient.On("Create", mock.Anything, mock.AnythingOfType("*unstructured.Unstructured"), metav1.CreateOptions{}, []string(nil)).
			Return(nil, nil).Once()
		// EnsureFolderExists for child: Get returns NotFound, then Create succeeds.
		mockClient.On("Get", mock.Anything, stableUID, metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, stableUID))
		mockClient.On("Create", mock.Anything, mock.AnythingOfType("*unstructured.Unstructured"), metav1.CreateOptions{}, []string(nil)).
			Return(nil, nil).Once()

		fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), false)
		err := fm.CreateFolderWithUID(ctx, "parent/child/", stableUID)

		require.NoError(t, err)
		mockClient.AssertExpectations(t)
	})
}
