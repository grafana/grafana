package resources

import (
	"context"
	"errors"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
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
		repo.On("Read", mock.Anything, mock.Anything, mock.Anything).Return(nil, errors.New("not found")).Maybe()
		return repo, cfg
	}

	t.Run("returns path creation error when beforeCreate fails", func(t *testing.T) {
		repo, cfg := newRepo(t)
		tree := NewEmptyFolderTree()
		client := &fakeDynamicResourceClient{}
		hookErr := errors.New("beforeCreate failed")

		var intercepted []string
		fm := NewFolderManager(repo, client, tree, WithBeforeCreate(func(_ context.Context, folder Folder) error {
			intercepted = append(intercepted, folder.Path)
			return hookErr
		}))

		parent, err := fm.EnsureFolderPathExist(ctx, "a/b/dashboard.json")
		require.Error(t, err)
		require.Empty(t, parent)

		fA := ParseFolder("a", cfg.GetName())

		var pathErr *PathCreationError
		require.ErrorAs(t, err, &pathErr)
		require.Equal(t, "a", pathErr.Path)
		require.ErrorIs(t, err, hookErr)
		require.Equal(t, []string{"a"}, intercepted)
		require.Equal(t, []string{fA.ID}, client.getCalls)
		require.Empty(t, client.createCalls)
	})

	t.Run("allows all creations when beforeCreate returns nil", func(t *testing.T) {
		repo, cfg := newRepo(t)
		tree := NewEmptyFolderTree()
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		var intercepted []string
		fm := NewFolderManager(repo, client, tree, WithBeforeCreate(func(_ context.Context, folder Folder) error {
			intercepted = append(intercepted, folder.Path)
			return nil
		}))

		parent, err := fm.EnsureFolderPathExist(ctx, "a/b/c/dashboard.json")
		require.NoError(t, err)

		fA := ParseFolder("a", cfg.GetName())
		fAB := ParseFolder("a/b", cfg.GetName())
		fABC := ParseFolder("a/b/c", cfg.GetName())

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
		tree := NewEmptyFolderTree()
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
		fm := NewFolderManager(repo, client, tree, WithBeforeCreate(func(_ context.Context, folder Folder) error {
			intercepted = append(intercepted, folder.Path)
			if folder.Path == "a/b" {
				return hookErr
			}
			return nil
		}))

		parent, err := fm.EnsureFolderPathExist(ctx, "a/b/c/dashboard.json")
		require.Error(t, err)
		require.Empty(t, parent)

		var pathErr *PathCreationError
		require.ErrorAs(t, err, &pathErr)
		require.Equal(t, "a/b", pathErr.Path)
		require.ErrorIs(t, err, hookErr)
		require.Equal(t, []string{"a", "a/b"}, intercepted)

		fA := ParseFolder("a", cfg.GetName())
		fAB := ParseFolder("a/b", cfg.GetName())
		fABC := ParseFolder("a/b/c", cfg.GetName())

		require.Equal(t, []string{fA.ID, fAB.ID}, client.getCalls)
		require.Equal(t, []string{fA.ID}, client.createCalls)
		require.True(t, tree.In(fA.ID))
		require.False(t, tree.In(fAB.ID))
		require.False(t, tree.In(fABC.ID))
	})

	t.Run("existing folders in tree do not call beforeCreate", func(t *testing.T) {
		repo, cfg := newRepo(t)
		tree := NewEmptyFolderTree()

		fA := ParseFolder("a", cfg.GetName())
		fAB := ParseFolder("a/b", cfg.GetName())
		tree.Add(fA, RootFolder(cfg))
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
		fm := NewFolderManager(repo, client, tree, WithBeforeCreate(func(_ context.Context, folder Folder) error {
			intercepted = append(intercepted, folder.Path)
			return nil
		}))

		parent, err := fm.EnsureFolderPathExist(ctx, "a/b/c/dashboard.json")
		require.NoError(t, err)

		fABC := ParseFolder("a/b/c", cfg.GetName())
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
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Same Title", cfg.Name), nil
			},
		}

		fm := NewFolderManager(repo, client, tree)
		err := fm.EnsureFolderExists(ctx, Folder{
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
		tree := NewEmptyFolderTree()

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

		fm := NewFolderManager(repo, client, tree)
		err := fm.EnsureFolderExists(ctx, Folder{
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
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Title", cfg.Name), nil
			},
			updateFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return nil, fmt.Errorf("conflict")
			},
		}

		fm := NewFolderManager(repo, client, tree)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:    "folder-id",
			Title: "New Title",
			Path:  "",
		}, "")

		require.Error(t, err)
		require.ErrorContains(t, err, "update folder")
		require.Equal(t, []string{"folder-id"}, client.updateCalls)
	})

	t.Run("errors when folder is not managed by a repository", func(t *testing.T) {
		repo, _ := newRepo(t)
		tree := NewEmptyFolderTree()

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

		fm := NewFolderManager(repo, client, tree)
		err := fm.EnsureFolderExists(ctx, Folder{
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
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Title", "other-repo"), nil
			},
		}

		fm := NewFolderManager(repo, client, tree)
		err := fm.EnsureFolderExists(ctx, Folder{
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

		fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree())
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
		rw.On("Read", mock.Anything, "parent/_folder.json", "").Return(nil, errors.New("not found")).Maybe()

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

		fm := NewFolderManager(rw, mockClient, tree)
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
		rw.On("Read", mock.Anything, "parent/_folder.json", "").Return(nil, errors.New("not found")).Maybe()

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

		fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree())
		err := fm.CreateFolderWithUID(ctx, "parent/child/", stableUID)

		require.NoError(t, err)
		mockClient.AssertExpectations(t)
	})

	t.Run("nested folder with metadata flag reads stable parent UID from _folder.json", func(t *testing.T) {
		ctx := context.Background()
		const stableUID = "child-stable-uid"
		const stableParentUID = "stable-parent-uid"

		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "parent/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-parent-uid"},"spec":{"title":"parent"}}`)}, nil)

		mockClient := &MockDynamicResourceInterface{}
		// EnsureFolderExists for parent with stable UID from _folder.json
		mockClient.On("Get", mock.Anything, stableParentUID, metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, stableParentUID))
		mockClient.On("Create", mock.Anything, mock.AnythingOfType("*unstructured.Unstructured"), metav1.CreateOptions{}, []string(nil)).
			Return(nil, nil).Once()
		// EnsureFolderExists for child
		mockClient.On("Get", mock.Anything, stableUID, metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, stableUID))
		mockClient.On("Create", mock.Anything, mock.AnythingOfType("*unstructured.Unstructured"), metav1.CreateOptions{}, []string(nil)).
			Return(nil, nil).Once()

		fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), WithFolderMetadataEnabled(true))
		err := fm.CreateFolderWithUID(ctx, "parent/child/", stableUID)

		require.NoError(t, err)
		mockClient.AssertExpectations(t)
	})

	t.Run("nested folder with metadata flag falls back to hash UID when _folder.json absent", func(t *testing.T) {
		ctx := context.Background()
		const stableUID = "child-stable-uid"

		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "parent/_folder.json", "").
			Return(nil, repository.ErrFileNotFound)

		parentFolder := ParseFolder("parent/", config.Name)

		mockClient := &MockDynamicResourceInterface{}
		// EnsureFolderExists for parent with hash-derived UID (fallback)
		mockClient.On("Get", mock.Anything, parentFolder.ID, metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, parentFolder.ID))
		mockClient.On("Create", mock.Anything, mock.AnythingOfType("*unstructured.Unstructured"), metav1.CreateOptions{}, []string(nil)).
			Return(nil, nil).Once()
		// EnsureFolderExists for child
		mockClient.On("Get", mock.Anything, stableUID, metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, stableUID))
		mockClient.On("Create", mock.Anything, mock.AnythingOfType("*unstructured.Unstructured"), metav1.CreateOptions{}, []string(nil)).
			Return(nil, nil).Once()

		fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), WithFolderMetadataEnabled(true))
		err := fm.CreateFolderWithUID(ctx, "parent/child/", stableUID)

		require.NoError(t, err)
		mockClient.AssertExpectations(t)
	})
}

func TestEnsureFolderPathExist_MetadataTitle(t *testing.T) {
	ctx := context.Background()

	t.Run("uses spec.title from _folder.json instead of directory name", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"Custom Title"}}`)}, nil)

		var createdFolder Folder
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, NewEmptyFolderTree(), WithBeforeCreate(func(_ context.Context, folder Folder) error {
			createdFolder = folder
			return nil
		}), WithFolderMetadataEnabled(true))

		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Equal(t, "Custom Title", createdFolder.Title)
		require.Equal(t, "stable-uid", createdFolder.ID)
	})

	t.Run("falls back to directory name when spec.title is empty", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":""}}`)}, nil)

		var createdFolder Folder
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, NewEmptyFolderTree(), WithBeforeCreate(func(_ context.Context, folder Folder) error {
			createdFolder = folder
			return nil
		}), WithFolderMetadataEnabled(true))

		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Equal(t, "my-folder", createdFolder.Title)
	})

	t.Run("uses directory name when no _folder.json exists", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(nil, repository.ErrFileNotFound)

		var createdFolder Folder
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, NewEmptyFolderTree(), WithBeforeCreate(func(_ context.Context, folder Folder) error {
			createdFolder = folder
			return nil
		}), WithFolderMetadataEnabled(true))

		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json")
		require.NoError(t, err)
		require.Equal(t, "my-folder", createdFolder.Title)
		require.NotEmpty(t, parent)
	})

	t.Run("uses spec.title from _folder.json inside walk for nested folders", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		// Pre-walk reads leaf folder metadata — not found so we walk
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "").
			Return(nil, repository.ErrFileNotFound)
		// Walk reads parent folder metadata — has custom title
		rw.On("Read", mock.Anything, "parent/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"parent-uid"},"spec":{"title":"Parent Custom"}}`)}, nil)

		var createdFolders []Folder
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, NewEmptyFolderTree(), WithBeforeCreate(func(_ context.Context, folder Folder) error {
			createdFolders = append(createdFolders, folder)
			return nil
		}), WithFolderMetadataEnabled(true))

		_, err := fm.EnsureFolderPathExist(ctx, "parent/child/dashboard.json")
		require.NoError(t, err)
		require.Len(t, createdFolders, 2)
		// First created folder is "parent" — should have custom title from _folder.json
		require.Equal(t, "Parent Custom", createdFolders[0].Title)
		require.Equal(t, "parent-uid", createdFolders[0].ID)
		// Second created folder is "child" — no metadata, uses directory name
		require.Equal(t, "child", createdFolders[1].Title)
	})
}

func TestEnsureFolderPathExist_ReconcileTitle(t *testing.T) {
	ctx := context.Background()

	managedFolder := func(name, title, managerIdentity string) *unstructured.Unstructured {
		return &unstructured.Unstructured{
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
	}

	t.Run("updates title when _folder.json title differs from Grafana", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"New Title"}}`)}, nil)

		// Folder NOT in tree — EnsureFolderExists will be called and reconcile the title.
		tree := NewEmptyFolderTree()

		var updatedObj *unstructured.Unstructured
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Title", config.Name), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				updatedObj = obj.DeepCopy()
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Equal(t, []string{"stable-uid"}, client.getCalls)
		require.Equal(t, []string{"stable-uid"}, client.updateCalls)

		newTitle, _, _ := unstructured.NestedString(updatedObj.Object, "spec", "title")
		require.Equal(t, "New Title", newTitle)
	})

	t.Run("no update when _folder.json title matches Grafana", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"Same Title"}}`)}, nil)

		// Folder NOT in tree — EnsureFolderExists will be called but no update needed.
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Same Title", config.Name), nil
			},
		}

		fm := NewFolderManager(rw, client, tree, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Equal(t, []string{"stable-uid"}, client.getCalls)
		require.Empty(t, client.updateCalls, "should not update when title matches")
	})

	t.Run("no API call when no _folder.json exists", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(nil, repository.ErrFileNotFound)

		tree := NewEmptyFolderTree()
		f := ParseFolder("my-folder/", config.Name)
		tree.Add(f, "")

		client := &fakeDynamicResourceClient{}

		fm := NewFolderManager(rw, client, tree, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json")
		require.NoError(t, err)
		require.Equal(t, f.ID, parent)
		require.Empty(t, client.getCalls, "should not call GET when no _folder.json")
		require.Empty(t, client.updateCalls, "should not call UPDATE when no _folder.json")
	})

	t.Run("reconciles title inside walk for nested path", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		// Pre-walk reads leaf folder metadata — not found so we walk
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "").
			Return(nil, repository.ErrFileNotFound)
		// Walk reads parent folder metadata — has new title
		rw.On("Read", mock.Anything, "parent/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"parent-uid"},"spec":{"title":"New Parent Title"}}`)}, nil)

		// Neither parent nor child in tree — walk processes both via EnsureFolderExists.
		tree := NewEmptyFolderTree()

		var updatedObj *unstructured.Unstructured
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				if name == "parent-uid" {
					return managedFolder(name, "Old Parent Title", config.Name), nil
				}
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				updatedObj = obj.DeepCopy()
				return obj, nil
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, WithFolderMetadataEnabled(true))
		_, err := fm.EnsureFolderPathExist(ctx, "parent/child/dashboard.json")
		require.NoError(t, err)

		// Parent title should have been reconciled
		require.Contains(t, client.getCalls, "parent-uid")
		require.Equal(t, []string{"parent-uid"}, client.updateCalls)
		newTitle, _, _ := unstructured.NestedString(updatedObj.Object, "spec", "title")
		require.Equal(t, "New Parent Title", newTitle)

		// Child should have been created
		childF := ParseFolder("parent/child", config.Name)
		require.Contains(t, client.getCalls, childF.ID)
		require.Contains(t, client.createCalls, childF.ID)
	})

	t.Run("no API call when _folder.json has empty spec.title", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":""}}`)}, nil)

		tree := NewEmptyFolderTree()
		f := ParseFolder("my-folder/", config.Name)
		f.ID = "stable-uid"
		tree.Add(f, "")

		client := &fakeDynamicResourceClient{}

		fm := NewFolderManager(rw, client, tree, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Empty(t, client.getCalls, "should not call GET when _folder.json has empty title")
		require.Empty(t, client.updateCalls, "should not call UPDATE when _folder.json has empty title")
	})

	t.Run("skips reconciliation when folder already in tree", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"New Title"}}`)}, nil)

		// Folder IS in tree — returns early, no EnsureFolderExists call.
		tree := NewEmptyFolderTree()
		f := ParseFolder("my-folder/", config.Name)
		f.ID = "stable-uid"
		tree.Add(f, "")

		client := &fakeDynamicResourceClient{}

		fm := NewFolderManager(rw, client, tree, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Empty(t, client.getCalls, "should not call GET when folder is already in tree")
		require.Empty(t, client.updateCalls, "should not call UPDATE when folder is already in tree")
	})

	t.Run("returns error when reconciliation fails", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"New Title"}}`)}, nil)

		// Folder NOT in tree — EnsureFolderExists will try to update the title and fail.
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Title", config.Name), nil
			},
			updateFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return nil, fmt.Errorf("conflict")
			},
		}

		fm := NewFolderManager(rw, client, tree, WithFolderMetadataEnabled(true))
		_, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json")
		require.Error(t, err)
		require.ErrorContains(t, err, "update folder title")
		require.ErrorContains(t, err, "conflict")
	})

	t.Run("returns PathCreationError when reconciliation fails inside walk", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		// Pre-walk reads "parent/child/_folder.json" — not found, so we enter the walk.
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "").
			Return(nil, repository.ErrFileNotFound)
		// Walk traverse="parent" reads "parent/_folder.json" — returns metadata with a new title.
		rw.On("Read", mock.Anything, "parent/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"parent-uid"},"spec":{"title":"New Parent Title"}}`)}, nil)

		// Neither parent nor child in tree — walk tries EnsureFolderExists for parent, which fails.
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Parent Title", config.Name), nil
			},
			updateFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return nil, fmt.Errorf("conflict")
			},
		}

		fm := NewFolderManager(rw, client, tree, WithFolderMetadataEnabled(true))
		_, err := fm.EnsureFolderPathExist(ctx, "parent/child/dashboard.json")
		require.Error(t, err)

		var pathErr *PathCreationError
		require.ErrorAs(t, err, &pathErr)
		require.Equal(t, "parent", pathErr.Path)
		require.ErrorContains(t, err, "update folder title")
		require.ErrorContains(t, err, "conflict")
	})
}

func TestEnsureFolderPathExist_MetadataErrors(t *testing.T) {
	ctx := context.Background()

	t.Run("flag ON + non-NotFound error at pre-walk site returns error", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "parent/_folder.json", "").
			Return(nil, errors.New("connection refused"))

		client := &fakeDynamicResourceClient{}
		fm := NewFolderManager(rw, client, NewEmptyFolderTree(), WithFolderMetadataEnabled(true))

		_, err := fm.EnsureFolderPathExist(ctx, "parent/child.json")
		require.Error(t, err)
		require.ErrorContains(t, err, "connection refused")
		require.Empty(t, client.getCalls)
	})

	t.Run("flag ON + non-NotFound error inside walk returns error", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		// pre-walk reads "parent/child/_folder.json" — file not found, proceed to walk
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "").
			Return(nil, repository.ErrFileNotFound)
		// walk traverse="parent" reads "parent/_folder.json" — real error
		rw.On("Read", mock.Anything, "parent/_folder.json", "").
			Return(nil, errors.New("connection refused"))

		client := &fakeDynamicResourceClient{}
		fm := NewFolderManager(rw, client, NewEmptyFolderTree(), WithFolderMetadataEnabled(true))

		_, err := fm.EnsureFolderPathExist(ctx, "parent/child/file.json")
		require.Error(t, err)
		require.ErrorContains(t, err, "connection refused")
		require.Empty(t, client.getCalls)
	})

	t.Run("flag OFF + non-NotFound error silently ignored", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		// Pre-populate tree so the function returns early after ignoring the error.
		tree := NewEmptyFolderTree()
		parentFolder := ParseFolder("parent/", config.Name)
		tree.Add(parentFolder, "")

		client := &fakeDynamicResourceClient{}
		fm := NewFolderManager(rw, client, tree)

		parent, err := fm.EnsureFolderPathExist(ctx, "parent/file.json")
		require.NoError(t, err)
		require.Equal(t, parentFolder.ID, parent)
		require.Empty(t, client.getCalls)
	})

	t.Run("flag ON + ErrFileNotFound silently ignored (hash-UID fallback)", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "parent/_folder.json", "").
			Return(nil, repository.ErrFileNotFound)

		// Pre-populate tree so the function returns early after ignoring the error.
		tree := NewEmptyFolderTree()
		parentFolder := ParseFolder("parent/", config.Name)
		tree.Add(parentFolder, "")

		client := &fakeDynamicResourceClient{}
		fm := NewFolderManager(rw, client, tree, WithFolderMetadataEnabled(true))

		parent, err := fm.EnsureFolderPathExist(ctx, "parent/file.json")
		require.NoError(t, err)
		require.Equal(t, parentFolder.ID, parent)
		require.Empty(t, client.getCalls)
	})
}

func TestEnsureFolderTreeExists(t *testing.T) {
	ctx := context.Background()
	const ref = "main"

	makeRepo := func(t *testing.T) *repository.MockReaderWriter {
		return repository.NewMockReaderWriter(t)
	}

	type fnCall struct {
		folder  Folder
		created bool
		err     error
	}

	// recordingFn returns an fn callback that records its invocations and propagates any error it receives.
	recordingFn := func(calls *[]fnCall) func(Folder, bool, error) error {
		return func(f Folder, created bool, err error) error {
			*calls = append(*calls, fnCall{f, created, err})
			return err
		}
	}

	makeInputTree := func(title string) (FolderTree, Folder) {
		folder := Folder{ID: "folder-" + title, Title: title, Path: title}
		tree := NewEmptyFolderTree()
		tree.Add(folder, "")
		return tree, folder
	}

	t.Run("without metadata - existing folder does not create or write", func(t *testing.T) {
		repo := makeRepo(t)
		inputTree, _ := makeInputTree("my-folder")

		repo.On("Read", mock.Anything, "my-folder/", ref).Return(&repository.FileInfo{}, nil)

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree())

		var calls []fnCall
		err := fm.EnsureFolderTreeExists(ctx, ref, "", inputTree, recordingFn(&calls))

		require.NoError(t, err)
		require.Len(t, calls, 1)
		require.False(t, calls[0].created)
		require.NoError(t, calls[0].err)
	})

	t.Run("without metadata - new folder is created in repo", func(t *testing.T) {
		repo := makeRepo(t)
		inputTree, _ := makeInputTree("my-folder")

		repo.On("Read", mock.Anything, "my-folder/", ref).Return(nil, repository.ErrFileNotFound)
		repo.On("Create", mock.Anything, "my-folder/", ref, mock.Anything, "Add folder my-folder/").Return(nil)

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree())

		var calls []fnCall
		err := fm.EnsureFolderTreeExists(ctx, ref, "", inputTree, recordingFn(&calls))

		require.NoError(t, err)
		require.Len(t, calls, 1)
		require.True(t, calls[0].created)
		require.NoError(t, calls[0].err)
	})

	t.Run("with metadata - existing folder does not write metadata file by default", func(t *testing.T) {
		repo := makeRepo(t)
		inputTree, _ := makeInputTree("my-folder")

		repo.On("Read", mock.Anything, "my-folder/", ref).Return(&repository.FileInfo{}, nil)
		// Write must NOT be called; the mock will fail the test if it is.

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(),
			WithFolderMetadataEnabled(true))

		var calls []fnCall
		err := fm.EnsureFolderTreeExists(ctx, ref, "", inputTree, recordingFn(&calls))

		require.NoError(t, err)
		require.Len(t, calls, 1)
		require.False(t, calls[0].created)
		require.NoError(t, calls[0].err)
	})

	t.Run("with metadata - existing folder does not write metadata file", func(t *testing.T) {
		repo := makeRepo(t)
		inputTree, _ := makeInputTree("my-folder")

		repo.On("Read", mock.Anything, "my-folder/", ref).Return(&repository.FileInfo{}, nil)
		// Create must NOT be called; the mock will fail the test if it is.

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(),
			WithFolderMetadataEnabled(true))

		var calls []fnCall
		err := fm.EnsureFolderTreeExists(ctx, ref, "", inputTree, recordingFn(&calls))

		require.NoError(t, err)
		require.Len(t, calls, 1)
		require.False(t, calls[0].created)
		require.NoError(t, calls[0].err)
	})

	t.Run("with metadata - new folder is created and writes metadata file", func(t *testing.T) {
		repo := makeRepo(t)
		inputTree, _ := makeInputTree("my-folder")

		repo.On("Read", mock.Anything, "my-folder/", ref).Return(nil, repository.ErrFileNotFound)
		repo.On("Create", mock.Anything, "my-folder/_folder.json", ref, mock.Anything, "Add folder and folder metadata my-folder/").Return(nil)

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(),
			WithFolderMetadataEnabled(true))

		var calls []fnCall
		err := fm.EnsureFolderTreeExists(ctx, ref, "", inputTree, recordingFn(&calls))

		require.NoError(t, err)
		require.Len(t, calls, 1)
		require.True(t, calls[0].created)
		require.NoError(t, calls[0].err)
	})

	t.Run("with metadata - metadata create fails propagates error through fn", func(t *testing.T) {
		repo := makeRepo(t)
		inputTree, _ := makeInputTree("my-folder")

		createErr := errors.New("disk full")
		repo.On("Read", mock.Anything, "my-folder/", ref).Return(nil, repository.ErrFileNotFound)
		repo.On("Create", mock.Anything, "my-folder/_folder.json", ref, mock.Anything, "Add folder and folder metadata my-folder/").Return(createErr)

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(),
			WithFolderMetadataEnabled(true))

		var calls []fnCall
		err := fm.EnsureFolderTreeExists(ctx, ref, "", inputTree, recordingFn(&calls))

		require.Error(t, err)
		require.ErrorIs(t, err, createErr)
		require.Len(t, calls, 1)
		require.True(t, calls[0].created)
		require.ErrorIs(t, calls[0].err, createErr)
	})

	t.Run("folder creation fails - metadata is not written and error propagates", func(t *testing.T) {
		repo := makeRepo(t)
		inputTree, _ := makeInputTree("my-folder")

		createErr := errors.New("repo unavailable")
		repo.On("Read", mock.Anything, "my-folder/", ref).Return(nil, repository.ErrFileNotFound)
		repo.On("Create", mock.Anything, "my-folder/_folder.json", ref, mock.Anything, "Add folder and folder metadata my-folder/").Return(createErr)

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(),
			WithFolderMetadataEnabled(true))

		var calls []fnCall
		err := fm.EnsureFolderTreeExists(ctx, ref, "", inputTree, recordingFn(&calls))

		require.Error(t, err)
		require.ErrorIs(t, err, createErr)
		require.Len(t, calls, 1)
		require.True(t, calls[0].created)
		require.ErrorIs(t, calls[0].err, createErr)
	})

	t.Run("with metadata and path prefix - paths are prefixed correctly", func(t *testing.T) {
		repo := makeRepo(t)
		inputTree, _ := makeInputTree("my-folder")

		repo.On("Read", mock.Anything, "grafana/my-folder/", ref).Return(nil, repository.ErrFileNotFound)
		repo.On("Create", mock.Anything, "grafana/my-folder/_folder.json", ref, mock.Anything, "Add folder and folder metadata grafana/my-folder/").Return(nil)

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(),
			WithFolderMetadataEnabled(true))

		var calls []fnCall
		err := fm.EnsureFolderTreeExists(ctx, ref, "grafana", inputTree, recordingFn(&calls))

		require.NoError(t, err)
		require.Len(t, calls, 1)
		require.True(t, calls[0].created)
		require.NoError(t, calls[0].err)
	})

	t.Run("with metadata - only new folders get a metadata file", func(t *testing.T) {
		repo := makeRepo(t)

		folderA := Folder{ID: "folder-alpha", Title: "alpha", Path: "alpha"}
		folderB := Folder{ID: "folder-beta", Title: "beta", Path: "beta"}
		inputTree := NewEmptyFolderTree()
		inputTree.Add(folderA, "")
		inputTree.Add(folderB, "")

		repo.On("Read", mock.Anything, "alpha/", ref).Return(&repository.FileInfo{}, nil)
		repo.On("Read", mock.Anything, "beta/", ref).Return(nil, repository.ErrFileNotFound)
		// alpha already exists — Create must NOT be called for alpha/_folder.json
		repo.On("Create", mock.Anything, "beta/_folder.json", ref, mock.Anything, "Add folder and folder metadata beta/").Return(nil)

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(),
			WithFolderMetadataEnabled(true))

		var calls []fnCall
		err := fm.EnsureFolderTreeExists(ctx, ref, "", inputTree, recordingFn(&calls))

		require.NoError(t, err)
		require.Len(t, calls, 2)
		// Verify both folders had their fn called without errors
		for _, c := range calls {
			require.NoError(t, c.err)
		}
		// alpha was already present, beta was newly created
		callByTitle := make(map[string]fnCall, len(calls))
		for _, c := range calls {
			callByTitle[c.folder.Title] = c
		}
		require.False(t, callByTitle["alpha"].created)
		require.True(t, callByTitle["beta"].created)
	})
}
