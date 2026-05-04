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
		repo.On("Read", mock.Anything, mock.Anything, "test-ref").Return(nil, errors.New("not found")).Maybe()
		return repo, cfg
	}

	t.Run("returns path creation error when beforeCreate fails", func(t *testing.T) {
		repo, cfg := newRepo(t)
		tree := NewEmptyFolderTree()
		client := &fakeDynamicResourceClient{}
		hookErr := errors.New("beforeCreate failed")

		var intercepted []string
		fm := NewFolderManager(repo, client, tree, FolderKind, WithBeforeCreate(func(_ context.Context, folder Folder) error {
			intercepted = append(intercepted, folder.Path)
			return hookErr
		}))

		parent, err := fm.EnsureFolderPathExist(ctx, "a/b/dashboard.json", "test-ref")
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
		fm := NewFolderManager(repo, client, tree, FolderKind, WithBeforeCreate(func(_ context.Context, folder Folder) error {
			intercepted = append(intercepted, folder.Path)
			return nil
		}))

		parent, err := fm.EnsureFolderPathExist(ctx, "a/b/c/dashboard.json", "test-ref")
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
		fm := NewFolderManager(repo, client, tree, FolderKind, WithBeforeCreate(func(_ context.Context, folder Folder) error {
			intercepted = append(intercepted, folder.Path)
			if folder.Path == "a/b" {
				return hookErr
			}
			return nil
		}))

		parent, err := fm.EnsureFolderPathExist(ctx, "a/b/c/dashboard.json", "test-ref")
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
		fm := NewFolderManager(repo, client, tree, FolderKind, WithBeforeCreate(func(_ context.Context, folder Folder) error {
			intercepted = append(intercepted, folder.Path)
			return nil
		}))

		parent, err := fm.EnsureFolderPathExist(ctx, "a/b/c/dashboard.json", "test-ref")
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

		fm := NewFolderManager(repo, client, tree, FolderKind)
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

		fm := NewFolderManager(repo, client, tree, FolderKind)
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

		fm := NewFolderManager(repo, client, tree, FolderKind)
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

		fm := NewFolderManager(repo, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:    "folder-id",
			Title: "New Title",
			Path:  "",
		}, "")

		require.Error(t, err)
		var unmanagedErr *ResourceUnmanagedConflictError
		require.True(t, errors.As(err, &unmanagedErr), "should return ResourceUnmanagedConflictError")
		require.ErrorContains(t, err, "folder-id")
		require.ErrorContains(t, err, "already exists and is not managed")
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

		fm := NewFolderManager(repo, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:    "folder-id",
			Title: "New Title",
			Path:  "",
		}, "")

		require.Error(t, err)
		var ownErr *FolderManagedByOtherError
		require.True(t, errors.As(err, &ownErr), "should return FolderManagedByOtherError")
		require.Equal(t, "folder-id", ownErr.FolderID)
		require.Equal(t, "other-repo", ownErr.CurrentManager)
		require.Empty(t, client.updateCalls)
	})

	t.Run("errors when create-then-already-exists folder is managed by a different repository", func(t *testing.T) {
		// Race path: Get returns NotFound, Create races with another sync that
		// already wrote the folder under a different manager. The same typed
		// error must surface so the result is classified as a user warning.
		repo, _ := newRepo(t)
		tree := NewEmptyFolderTree()

		var getCount int
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				getCount++
				if getCount == 1 {
					return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
				}
				return managedFolder(name, "Title", "other-repo"), nil
			},
			createFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewAlreadyExists(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, "folder-id")
			},
		}

		fm := NewFolderManager(repo, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:    "folder-id",
			Title: "New Title",
			Path:  "",
		}, "")

		require.Error(t, err)
		var ownErr *FolderManagedByOtherError
		require.True(t, errors.As(err, &ownErr), "should return FolderManagedByOtherError")
		require.Equal(t, "folder-id", ownErr.FolderID)
		require.Equal(t, "other-repo", ownErr.CurrentManager)
	})

	t.Run("wraps folder depth API error as FolderDepthExceededError", func(t *testing.T) {
		repo, _ := newRepo(t)
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			createFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewBadRequest("folder max depth exceeded, max depth is 4")
			},
		}

		fm := NewFolderManager(repo, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:    "folder-id",
			Title: "New Title",
			Path:  "a/b/c/d/e/",
		}, "")

		require.Error(t, err)
		var depthErr *FolderDepthExceededError
		require.True(t, errors.As(err, &depthErr), "should return FolderDepthExceededError")
		require.Equal(t, "a/b/c/d/e/", depthErr.Path)
		require.NotEmpty(t, client.createCalls)
	})

	t.Run("wraps folder depth API error from Update (move) as FolderDepthExceededError", func(t *testing.T) {
		// When a managed folder already exists and provisioning tries to
		// move it (via Update) into a path that exceeds the folder API's
		// max depth, the resulting error must also be classified as a
		// depth violation so the sync surfaces it as a warning instead
		// of looping retries.
		repo, cfg := newRepo(t)
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Title", cfg.Name), nil
			},
			updateFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewBadRequest("Maximum nested folder depth reached")
			},
		}

		fm := NewFolderManager(repo, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:    "folder-id",
			Title: "New Title",
			Path:  "deep/path/that/exceeds/limit/",
		}, "")

		require.Error(t, err)
		var depthErr *FolderDepthExceededError
		require.True(t, errors.As(err, &depthErr), "Update path should also return FolderDepthExceededError")
		require.Equal(t, "deep/path/that/exceeds/limit/", depthErr.Path)
		require.NotEmpty(t, client.updateCalls)
	})

	t.Run("wraps folder UID-too-long API error as FolderUIDTooLongError", func(t *testing.T) {
		repo, _ := newRepo(t)
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			createFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				// Simulates the post-#123843 form: a structured 400 from
				// the folder apiserver carrying the legacy public message.
				// IsFolderUIDTooLongAPIError's substring fallbacks cover
				// the pre-fix legacy 500 form too; that's covered by the
				// matcher unit tests in errors_test.go.
				return nil, apierrors.NewBadRequest("uid too long, max 40 characters")
			},
		}

		fm := NewFolderManager(repo, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:    "a0123456789012345678901234567890123456789",
			Title: "Bare metal services engineering",
			Path:  "GMPO/bare-metal-services-engineering/",
		}, "")

		require.Error(t, err)
		var uidErr *FolderUIDTooLongError
		require.True(t, errors.As(err, &uidErr), "should return FolderUIDTooLongError")
		require.Equal(t, "GMPO/bare-metal-services-engineering/", uidErr.Path)
		require.Equal(t, "a0123456789012345678901234567890123456789", uidErr.UID)
		require.NotEmpty(t, client.createCalls)
	})

	t.Run("wraps folder UID-too-long API error from Update (move) as FolderUIDTooLongError", func(t *testing.T) {
		// Symmetric with the depth-exceeded Update case above: a managed
		// folder being moved into a path whose derived UID overflows must
		// also be classified as UID-too-long so the sync surfaces it as a
		// warning instead of looping retries.
		repo, cfg := newRepo(t)
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Title", cfg.Name), nil
			},
			updateFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewBadRequest("uid too long, max 40 characters")
			},
		}

		fm := NewFolderManager(repo, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:    "a0123456789012345678901234567890123456789",
			Title: "New Title",
			Path:  "GMPO/bare-metal-services-engineering/",
		}, "")

		require.Error(t, err)
		var uidErr *FolderUIDTooLongError
		require.True(t, errors.As(err, &uidErr), "Update path should also return FolderUIDTooLongError")
		require.Equal(t, "GMPO/bare-metal-services-engineering/", uidErr.Path)
		require.Equal(t, "a0123456789012345678901234567890123456789", uidErr.UID)
		require.NotEmpty(t, client.updateCalls)
	})

	t.Run("wraps generic folder validation 4xx as FolderValidationError", func(t *testing.T) {
		// Any folder-API 400 with a structured "folder.*" message ID that
		// is not one of the more specific cases above must be wrapped as
		// FolderValidationError so the sync surfaces it as a warning
		// rather than retrying. This case simulates the illegal-uid-chars
		// rejection (e.g. a _folder.json with a UID containing a space).
		repo, _ := newRepo(t)
		tree := NewEmptyFolderTree()

		genericValidation := &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    400,
				Message: "uid contains illegal characters",
				Details: &metav1.StatusDetails{
					UID: "folder.invalid-uid-chars",
				},
			},
		}

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			createFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return nil, genericValidation
			},
		}

		fm := NewFolderManager(repo, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:    "hello world",
			Title: "Bad title",
			Path:  "bad-folder/",
		}, "")

		require.Error(t, err)
		var validationErr *FolderValidationError
		require.True(t, errors.As(err, &validationErr), "should return FolderValidationError")
		require.Equal(t, "bad-folder/", validationErr.Path)
		// The more-specific wrappers must NOT claim this error.
		var depthErr *FolderDepthExceededError
		require.False(t, errors.As(err, &depthErr), "must not be classified as depth-exceeded")
		var uidErr *FolderUIDTooLongError
		require.False(t, errors.As(err, &uidErr), "must not be classified as uid-too-long")
		require.NotEmpty(t, client.createCalls)
	})

	t.Run("wraps generic folder validation 4xx from Update (move) as FolderValidationError", func(t *testing.T) {
		// Symmetric with the depth/uid-too-long Update cases above: a
		// generic folder validation rejection on the Update path must
		// also be classified as a warning instead of looping retries.
		repo, cfg := newRepo(t)
		tree := NewEmptyFolderTree()

		genericValidation := &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    400,
				Message: "uid contains illegal characters",
				Details: &metav1.StatusDetails{
					UID: "folder.invalid-uid-chars",
				},
			},
		}

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Title", cfg.Name), nil
			},
			updateFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return nil, genericValidation
			},
		}

		fm := NewFolderManager(repo, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:    "hello world",
			Title: "New Title",
			Path:  "bad-folder/",
		}, "")

		require.Error(t, err)
		var validationErr *FolderValidationError
		require.True(t, errors.As(err, &validationErr), "Update path should also return FolderValidationError")
		require.Equal(t, "bad-folder/", validationErr.Path)
		require.NotEmpty(t, client.updateCalls)
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

		fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), FolderKind)
		err := fm.CreateFolderWithUID(ctx, "myfolder/", stableUID, "test-ref")

		require.NoError(t, err)
		mockClient.AssertExpectations(t)
	})

	t.Run("nested folder with parent already in tree", func(t *testing.T) {
		ctx := context.Background()
		const stableUID = "child-stable-uid"

		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "parent/_folder.json", "test-ref").Return(nil, errors.New("not found")).Maybe()

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

		fm := NewFolderManager(rw, mockClient, tree, FolderKind)
		err := fm.CreateFolderWithUID(ctx, "parent/child/", stableUID, "test-ref")

		require.NoError(t, err)
		mockClient.AssertExpectations(t)
	})

	t.Run("nested folder where parent needs to be created", func(t *testing.T) {
		ctx := context.Background()
		const stableUID = "child-stable-uid"

		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "parent/_folder.json", "test-ref").Return(nil, errors.New("not found")).Maybe()

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

		fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), FolderKind)
		err := fm.CreateFolderWithUID(ctx, "parent/child/", stableUID, "test-ref")

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
		rw.On("Read", mock.Anything, "parent/_folder.json", "test-ref").
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

		fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
		err := fm.CreateFolderWithUID(ctx, "parent/child/", stableUID, "test-ref")

		require.NoError(t, err)
		mockClient.AssertExpectations(t)
	})

	t.Run("nested folder with metadata flag falls back to hash UID when _folder.json absent", func(t *testing.T) {
		ctx := context.Background()
		const stableUID = "child-stable-uid"

		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "parent/_folder.json", "test-ref").
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

		fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
		err := fm.CreateFolderWithUID(ctx, "parent/child/", stableUID, "test-ref")

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
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
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

		fm := NewFolderManager(rw, client, NewEmptyFolderTree(), FolderKind, WithBeforeCreate(func(_ context.Context, folder Folder) error {
			createdFolder = folder
			return nil
		}), WithFolderMetadataEnabled(true))

		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Equal(t, "Custom Title", createdFolder.Title)
		require.Equal(t, "stable-uid", createdFolder.ID)
	})

	t.Run("falls back to directory name when spec.title is empty", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
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

		fm := NewFolderManager(rw, client, NewEmptyFolderTree(), FolderKind, WithBeforeCreate(func(_ context.Context, folder Folder) error {
			createdFolder = folder
			return nil
		}), WithFolderMetadataEnabled(true))

		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Equal(t, "my-folder", createdFolder.Title)
	})

	t.Run("uses directory name when no _folder.json exists", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
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

		fm := NewFolderManager(rw, client, NewEmptyFolderTree(), FolderKind, WithBeforeCreate(func(_ context.Context, folder Folder) error {
			createdFolder = folder
			return nil
		}), WithFolderMetadataEnabled(true))

		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")
		require.NoError(t, err)
		require.Equal(t, "my-folder", createdFolder.Title)
		require.NotEmpty(t, parent)
	})

	t.Run("uses spec.title from _folder.json inside walk for nested folders", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		// Pre-walk reads leaf folder metadata — not found so we walk
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "test-ref").
			Return(nil, repository.ErrFileNotFound)
		// Walk reads parent folder metadata — has custom title
		rw.On("Read", mock.Anything, "parent/_folder.json", "test-ref").
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

		fm := NewFolderManager(rw, client, NewEmptyFolderTree(), FolderKind, WithBeforeCreate(func(_ context.Context, folder Folder) error {
			createdFolders = append(createdFolders, folder)
			return nil
		}), WithFolderMetadataEnabled(true))

		_, err := fm.EnsureFolderPathExist(ctx, "parent/child/dashboard.json", "test-ref")
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

	managedFolder := func(name, title, managerIdentity, sourcePath string) *unstructured.Unstructured {
		annotations := map[string]interface{}{
			"grafana.app/managerId": managerIdentity,
		}
		if sourcePath != "" {
			annotations["grafana.app/sourcePath"] = sourcePath
		}
		return &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name":        name,
					"namespace":   "default",
					"annotations": annotations,
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
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"New Title"}}`)}, nil)

		// Folder NOT in tree — EnsureFolderExists will be called and reconcile the title.
		tree := NewEmptyFolderTree()

		var updatedObj *unstructured.Unstructured
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Title", config.Name, "my-folder"), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				updatedObj = obj.DeepCopy()
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")
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
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"Same Title"}}`)}, nil)

		// Folder NOT in tree — EnsureFolderExists will be called but no update needed.
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Same Title", config.Name, "my-folder"), nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Equal(t, []string{"stable-uid"}, client.getCalls)
		require.Empty(t, client.updateCalls, "should not update when title matches")
	})

	t.Run("no API call when no _folder.json exists", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
			Return(nil, repository.ErrFileNotFound)

		tree := NewEmptyFolderTree()
		f := ParseFolder("my-folder/", config.Name)
		tree.Add(f, "")

		client := &fakeDynamicResourceClient{}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")
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
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "test-ref").
			Return(nil, repository.ErrFileNotFound)
		// Walk reads parent folder metadata — has new title
		rw.On("Read", mock.Anything, "parent/_folder.json", "test-ref").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"parent-uid"},"spec":{"title":"New Parent Title"}}`)}, nil)

		// Neither parent nor child in tree — walk processes both via EnsureFolderExists.
		tree := NewEmptyFolderTree()

		var updatedObj *unstructured.Unstructured
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				if name == "parent-uid" {
					return managedFolder(name, "Old Parent Title", config.Name, "parent"), nil
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

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		_, err := fm.EnsureFolderPathExist(ctx, "parent/child/dashboard.json", "test-ref")
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
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":""}}`)}, nil)

		tree := NewEmptyFolderTree()
		f := ParseFolder("my-folder/", config.Name)
		f.ID = "stable-uid"
		tree.Add(f, "")

		client := &fakeDynamicResourceClient{}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Empty(t, client.getCalls, "should not call GET when _folder.json has empty title")
		require.Empty(t, client.updateCalls, "should not call UPDATE when _folder.json has empty title")
	})

	t.Run("skips reconciliation when folder in tree and hash matches", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
			Return(&repository.FileInfo{
				Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"Same Title"}}`),
				Hash: "same-hash",
			}, nil)

		// Folder IS in tree with matching state (title, path, hash) — returns early.
		tree := NewEmptyFolderTree()
		f := ParseFolder("my-folder/", config.Name)
		f.ID = "stable-uid"
		f.Title = "Same Title"
		f.MetadataHash = "same-hash"
		tree.Add(f, "")

		client := &fakeDynamicResourceClient{}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Empty(t, client.getCalls, "should not call GET when hash matches")
		require.Empty(t, client.updateCalls, "should not call UPDATE when hash matches")
	})

	t.Run("reconciles when folder in tree but hash differs", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
			Return(&repository.FileInfo{
				Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"New Title"}}`),
				Hash: "new-hash",
			}, nil)

		// Folder IS in tree but with old hash — should reconcile.
		tree := NewEmptyFolderTree()
		f := ParseFolder("my-folder/", config.Name)
		f.ID = "stable-uid"
		f.MetadataHash = "old-hash"
		tree.Add(f, "")

		var updatedObj *unstructured.Unstructured
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Title", config.Name, "my-folder"), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				updatedObj = obj
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Contains(t, client.getCalls, "stable-uid", "should call GET to reconcile")
		require.NotNil(t, updatedObj)
		newTitle, _, _ := unstructured.NestedString(updatedObj.Object, "spec", "title")
		require.Equal(t, "New Title", newTitle)
	})

	t.Run("reconciles when tree has empty hash (bootstrap)", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
			Return(&repository.FileInfo{
				Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"Same Title"}}`),
				Hash: "new-hash",
			}, nil)

		// Folder in tree with empty hash (pre-existing, before P1) — should reconcile to store hash.
		tree := NewEmptyFolderTree()
		f := ParseFolder("my-folder/", config.Name)
		f.ID = "stable-uid"
		f.MetadataHash = "" // no stored hash
		tree.Add(f, "")

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Same Title", config.Name, "my-folder"), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		require.Contains(t, client.getCalls, "stable-uid", "should call GET to store hash")
		require.Equal(t, []string{"stable-uid"}, client.updateCalls, "should update to store hash even though title matches")
	})

	t.Run("returns error when reconciliation fails", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"New Title"}}`)}, nil)

		// Folder NOT in tree — EnsureFolderExists will try to update the title and fail.
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Title", config.Name, "my-folder"), nil
			},
			updateFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return nil, fmt.Errorf("conflict")
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		_, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")
		require.Error(t, err)
		require.ErrorContains(t, err, "update folder")
		require.ErrorContains(t, err, "conflict")
	})

	t.Run("returns PathCreationError when reconciliation fails inside walk", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		// Pre-walk reads "parent/child/_folder.json" — not found, so we enter the walk.
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "test-ref").
			Return(nil, repository.ErrFileNotFound)
		// Walk traverse="parent" reads "parent/_folder.json" — returns metadata with a new title.
		rw.On("Read", mock.Anything, "parent/_folder.json", "test-ref").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"parent-uid"},"spec":{"title":"New Parent Title"}}`)}, nil)

		// Neither parent nor child in tree — walk tries EnsureFolderExists for parent, which fails.
		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "Old Parent Title", config.Name, "parent"), nil
			},
			updateFn: func(_ *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return nil, fmt.Errorf("conflict")
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		_, err := fm.EnsureFolderPathExist(ctx, "parent/child/dashboard.json", "test-ref")
		require.Error(t, err)

		var pathErr *PathCreationError
		require.ErrorAs(t, err, &pathErr)
		require.Equal(t, "parent", pathErr.Path)
		require.ErrorContains(t, err, "update folder")
		require.ErrorContains(t, err, "conflict")
	})
}

func TestEnsureFolderExists_MetadataHashUpdate(t *testing.T) {
	ctx := context.Background()

	newTestRepoConfig := func(name string) *provisioning.Repository {
		return &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
			},
		}
	}

	managedFolderWithChecksum := func(name, title, managerIdentity, sourcePath, checksum string) *unstructured.Unstructured {
		annotations := map[string]interface{}{
			"grafana.app/managerId": managerIdentity,
		}
		if sourcePath != "" {
			annotations["grafana.app/sourcePath"] = sourcePath
		}
		if checksum != "" {
			annotations["grafana.app/sourceChecksum"] = checksum
		}
		return &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name":        name,
					"namespace":   "default",
					"annotations": annotations,
				},
				"spec": map[string]interface{}{
					"title": title,
				},
			},
		}
	}

	t.Run("updates checksum when hash changed but title unchanged", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		tree := NewEmptyFolderTree()

		var updatedObj *unstructured.Unstructured
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolderWithChecksum(name, "Same Title", config.Name, "my-folder", "old-hash"), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				updatedObj = obj
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:           "folder-uid",
			Title:        "Same Title",
			Path:         "my-folder",
			MetadataHash: "new-hash",
		}, "")

		require.NoError(t, err)
		require.Equal(t, []string{"folder-uid"}, client.updateCalls, "should update even though title is unchanged")
		require.NotNil(t, updatedObj)

		// Verify checksum was updated
		checksum, _, _ := unstructured.NestedString(updatedObj.Object, "metadata", "annotations", "grafana.app/sourceChecksum")
		require.Equal(t, "new-hash", checksum)

		// Verify title was NOT changed
		title, _, _ := unstructured.NestedString(updatedObj.Object, "spec", "title")
		require.Equal(t, "Same Title", title)
	})

	t.Run("updates source path and checksum when both differ", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		tree := NewEmptyFolderTree()

		var updatedObj *unstructured.Unstructured
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolderWithChecksum(name, "Title", config.Name, "original/path", "old-hash"), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				updatedObj = obj
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:           "folder-uid",
			Title:        "Title",
			Path:         "my-folder",
			MetadataHash: "new-hash",
		}, "")

		require.NoError(t, err)
		require.NotNil(t, updatedObj)

		sourcePath, _, _ := unstructured.NestedString(updatedObj.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "my-folder", sourcePath, "sourcePath should be updated to the new path")

		checksum, _, _ := unstructured.NestedString(updatedObj.Object, "metadata", "annotations", "grafana.app/sourceChecksum")
		require.Equal(t, "new-hash", checksum)
	})

	t.Run("no update when both title and hash match", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolderWithChecksum(name, "Same Title", config.Name, "my-folder", "same-hash"), nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:           "folder-uid",
			Title:        "Same Title",
			Path:         "my-folder",
			MetadataHash: "same-hash",
		}, "")

		require.NoError(t, err)
		require.Empty(t, client.updateCalls, "should not update when title and hash both match")
	})

	t.Run("clears checksum when MetadataHash is empty and stored hash exists", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		tree := NewEmptyFolderTree()

		var updatedObj *unstructured.Unstructured
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolderWithChecksum(name, "Same Title", config.Name, "my-folder", "stored-hash"), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				updatedObj = obj
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:           "folder-uid",
			Title:        "Same Title",
			Path:         "my-folder",
			MetadataHash: "", // empty — e.g. metadata deleted
		}, "")

		require.NoError(t, err)
		require.Equal(t, []string{"folder-uid"}, client.updateCalls, "should update to clear the stored checksum")
		require.NotNil(t, updatedObj)

		checksum, _, _ := unstructured.NestedString(updatedObj.Object, "metadata", "annotations", "grafana.app/sourceChecksum")
		require.Empty(t, checksum, "checksum should be cleared")
	})
}

func TestEnsureFolderExists_ParentUpdate(t *testing.T) {
	ctx := context.Background()

	newTestRepoConfig := func(name string) *provisioning.Repository {
		return &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
			},
		}
	}

	managedFolderWithParent := func(name, title, managerIdentity, parent, sourcePath string) *unstructured.Unstructured {
		annotations := map[string]interface{}{
			"grafana.app/managerId": managerIdentity,
		}
		if parent != "" {
			annotations["grafana.app/folder"] = parent
		}
		if sourcePath != "" {
			annotations["grafana.app/sourcePath"] = sourcePath
		}
		return &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name":        name,
					"namespace":   "default",
					"annotations": annotations,
				},
				"spec": map[string]interface{}{
					"title": title,
				},
			},
		}
	}

	t.Run("updates parent when ParentID differs", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		tree := NewEmptyFolderTree()

		var updatedObj *unstructured.Unstructured
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolderWithParent(name, "Same Title", config.Name, "old-parent-uid", "my-folder"), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				updatedObj = obj
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:       "folder-uid",
			Title:    "Same Title",
			Path:     "my-folder",
			ParentID: "new-parent-uid",
		}, "new-parent-uid")

		require.NoError(t, err)
		require.Equal(t, []string{"folder-uid"}, client.updateCalls, "should update to fix parent annotation")
		require.NotNil(t, updatedObj)

		parentAnnotation, _, _ := unstructured.NestedString(updatedObj.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, "new-parent-uid", parentAnnotation)
	})

	t.Run("skips parent update when ParentID matches", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolderWithParent(name, "Same Title", config.Name, "same-parent", "my-folder"), nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:       "folder-uid",
			Title:    "Same Title",
			Path:     "my-folder",
			ParentID: "same-parent",
		}, "same-parent")

		require.NoError(t, err)
		require.Empty(t, client.updateCalls, "should not update when parent matches")
	})

	t.Run("updates parent when ParentID empty and current parent is non-empty", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		tree := NewEmptyFolderTree()

		var updatedObj *unstructured.Unstructured
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolderWithParent(name, "Same Title", config.Name, "some-parent", "my-folder"), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				updatedObj = obj
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:    "folder-uid",
			Title: "Same Title",
			Path:  "my-folder",
			// ParentID is empty — moving to root
		}, "")

		require.NoError(t, err)
		require.Equal(t, []string{"folder-uid"}, client.updateCalls, "should update to clear parent annotation when moving to root")
		require.NotNil(t, updatedObj)

		parentAnnotation, _, _ := unstructured.NestedString(updatedObj.Object, "metadata", "annotations", "grafana.app/folder")
		require.Empty(t, parentAnnotation, "parent annotation should be cleared")
	})

	t.Run("skips update when both ParentID and current parent are empty", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				// Existing folder also has no parent (root)
				return managedFolderWithParent(name, "Same Title", config.Name, "", "my-folder"), nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind)
		err := fm.EnsureFolderExists(ctx, Folder{
			ID:    "folder-uid",
			Title: "Same Title",
			Path:  "my-folder",
			// ParentID is empty — root folder, same as existing
		}, "")

		require.NoError(t, err)
		require.Empty(t, client.updateCalls, "should not update when both ParentID and current parent are empty")
	})
}

func TestEnsureFolderPathExist_MetadataErrors(t *testing.T) {
	ctx := context.Background()

	t.Run("flag ON + non-NotFound error at pre-walk site returns error", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "parent/_folder.json", "test-ref").
			Return(nil, errors.New("connection refused"))

		client := &fakeDynamicResourceClient{}
		fm := NewFolderManager(rw, client, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))

		_, err := fm.EnsureFolderPathExist(ctx, "parent/child.json", "test-ref")
		require.Error(t, err)
		require.ErrorContains(t, err, "connection refused")
		require.Empty(t, client.getCalls)
	})

	t.Run("flag ON + non-NotFound error inside walk returns error", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		// pre-walk reads "parent/child/_folder.json" — file not found, proceed to walk
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "test-ref").
			Return(nil, repository.ErrFileNotFound)
		// walk traverse="parent" reads "parent/_folder.json" — real error
		rw.On("Read", mock.Anything, "parent/_folder.json", "test-ref").
			Return(nil, errors.New("connection refused"))

		client := &fakeDynamicResourceClient{}
		fm := NewFolderManager(rw, client, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))

		_, err := fm.EnsureFolderPathExist(ctx, "parent/child/file.json", "test-ref")
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
		fm := NewFolderManager(rw, client, tree, FolderKind)

		parent, err := fm.EnsureFolderPathExist(ctx, "parent/file.json", "test-ref")
		require.NoError(t, err)
		require.Equal(t, parentFolder.ID, parent)
		require.Empty(t, client.getCalls)
	})

	t.Run("flag ON + ErrFileNotFound silently ignored (hash-UID fallback)", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "parent/_folder.json", "test-ref").
			Return(nil, repository.ErrFileNotFound)

		// Pre-populate tree so the function returns early after ignoring the error.
		tree := NewEmptyFolderTree()
		parentFolder := ParseFolder("parent/", config.Name)
		tree.Add(parentFolder, "")

		client := &fakeDynamicResourceClient{}
		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))

		parent, err := fm.EnsureFolderPathExist(ctx, "parent/file.json", "test-ref")
		require.NoError(t, err)
		require.Equal(t, parentFolder.ID, parent)
		require.Empty(t, client.getCalls)
	})
}

// TestEnsureFolderPathExist_UIDConflict covers the UID conflict guard inside the
// safepath.Walk callback. Three distinct branches are exercised
func TestEnsureFolderPathExist_UIDConflict(t *testing.T) {
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

	// folderJSON returns minimal _folder.json bytes for a given stable UID.
	folderJSON := func(uid, title string) []byte {
		return []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"` + uid + `"},"spec":{"title":"` + title + `"}}`)
	}

	t.Run("returns error when UID from _folder.json is already used by a different path", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		// Both the pre-walk check and the walk step read the same _folder.json.
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
			Return(&repository.FileInfo{
				Data: folderJSON("conflict-uid", "My Folder"),
				Hash: "new-hash",
			}, nil)

		// Tree already has "conflict-uid" registered under a *different* path.
		tree := NewEmptyFolderTree()
		tree.Add(Folder{
			ID:           "conflict-uid",
			Path:         "existing-folder",
			Title:        "Existing",
			MetadataHash: "existing-hash", // different hash, so the early-return guard doesn't fire
		}, "")

		client := &fakeDynamicResourceClient{}
		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))

		_, err := fm.EnsureFolderPathExist(ctx, "my-folder/file.json", "test-ref")

		require.Error(t, err)
		require.ErrorContains(t, err, "conflict-uid")
		require.ErrorContains(t, err, "my-folder")
		require.ErrorContains(t, err, "existing-folder")
		// The conflict error is surfaced directly – no PathCreationError wrapper.
		var pathErr *PathCreationError
		require.False(t, errors.As(err, &pathErr), "UID conflict error should not be wrapped in PathCreationError")
		// No folder creation should have been attempted.
		require.Empty(t, client.createCalls)
	})

	t.Run("skips folder creation in walk when UID and metadata hash match tree entry", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		// Pre-walk reads the leaf folder (parent/child) — not found, so we enter the walk.
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "test-ref").
			Return(nil, repository.ErrFileNotFound)
		// Walk step for "parent" — _folder.json with a stable UID and a known hash.
		rw.On("Read", mock.Anything, "parent/_folder.json", "test-ref").
			Return(&repository.FileInfo{
				Data: folderJSON("parent-uid", "Parent"),
				Hash: "parent-hash",
			}, nil)

		// "parent-uid" is already in the tree with the *same* hash — skip creation.
		tree := NewEmptyFolderTree()
		tree.Add(Folder{
			ID:           "parent-uid",
			Path:         "parent",
			Title:        "Parent",
			MetadataHash: "parent-hash",
		}, "")

		childFolder := ParseFolder("parent/child", config.Name)
		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		parent, err := fm.EnsureFolderPathExist(ctx, "parent/child/file.json", "test-ref")

		require.NoError(t, err)
		require.Equal(t, childFolder.ID, parent)
		// "parent-uid" must NOT have triggered a Get/Create — the walk skipped it.
		require.NotContains(t, client.getCalls, "parent-uid", "parent folder should be skipped (hash match)")
		require.NotContains(t, client.createCalls, "parent-uid", "parent folder should not be created (hash match)")
		// "parent/child" must have been created because it was not in the tree.
		require.Contains(t, client.createCalls, childFolder.ID, "child folder should be created")
	})

	t.Run("falls through to EnsureFolderExists when UID matches same path but hash differs", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		// Pre-walk reads the leaf folder — not found, so we enter the walk.
		rw.On("Read", mock.Anything, "parent/child/_folder.json", "test-ref").
			Return(nil, repository.ErrFileNotFound)
		// Walk step for "parent" — same UID as in tree, but a newer hash.
		rw.On("Read", mock.Anything, "parent/_folder.json", "test-ref").
			Return(&repository.FileInfo{
				Data: folderJSON("parent-uid", "Parent Updated"),
				Hash: "new-hash",
			}, nil)

		// "parent-uid" is in the tree at the same path but with a *stale* hash.
		tree := NewEmptyFolderTree()
		tree.Add(Folder{
			ID:           "parent-uid",
			Path:         "parent",
			Title:        "Parent",
			MetadataHash: "old-hash",
		}, "")

		childFolder := ParseFolder("parent/child", config.Name)

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				if name == "parent-uid" {
					return managedFolder("parent-uid", "Parent", config.Name), nil
				}
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		_, err := fm.EnsureFolderPathExist(ctx, "parent/child/file.json", "test-ref")

		require.NoError(t, err)
		// EnsureFolderExists must have been called for "parent-uid" (reconcile stale hash).
		require.Contains(t, client.getCalls, "parent-uid", "should call GET to reconcile stale hash")
		require.Contains(t, client.updateCalls, "parent-uid", "should call UPDATE to store new hash")
		// "parent/child" must also have been handled.
		require.Contains(t, client.getCalls, childFolder.ID)
	})

	t.Run("UID conflict error contains expected message format", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "team-a/_folder.json", "test-ref").
			Return(&repository.FileInfo{
				Data: folderJSON("shared-uid", "Team A"),
				Hash: "hash-a",
			}, nil)

		tree := NewEmptyFolderTree()
		tree.Add(Folder{
			ID:           "shared-uid",
			Path:         "team-b",
			Title:        "Team B",
			MetadataHash: "hash-b",
		}, "")

		fm := NewFolderManager(rw, &fakeDynamicResourceClient{}, tree, FolderKind, WithFolderMetadataEnabled(true))
		_, err := fm.EnsureFolderPathExist(ctx, "team-a/dashboard.json", "test-ref")

		require.Error(t, err)
		var validationErr *ResourceValidationError
		require.ErrorAs(t, err, &validationErr, "UID conflict should be a ResourceValidationError")
		require.ErrorContains(t, err, `folder UID "shared-uid" defined in "team-a" is already used by folder at path "team-b"`)
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

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(), FolderKind)

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

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(), FolderKind)

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

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(), FolderKind,
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

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(), FolderKind,
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

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(), FolderKind,
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

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(), FolderKind,
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

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(), FolderKind,
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

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(), FolderKind,
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

		fm := NewFolderManager(repo, &fakeDynamicResourceClient{}, NewEmptyFolderTree(), FolderKind,
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

func TestRenameFolderPath(t *testing.T) {
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
						"grafana.app/managedBy":  "repo",
						"grafana.app/managerId":  managerIdentity,
						"grafana.app/sourcePath": "",
					},
				},
				"spec": map[string]interface{}{
					"title": title,
				},
			},
		}
	}

	t.Run("same stable UID returns empty string (no cleanup needed)", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		metaJSON := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"My Folder"}}`)
		rw.On("Read", mock.Anything, "old-team/_folder.json", "ref-old").
			Return(&repository.FileInfo{Data: metaJSON}, nil)
		rw.On("Read", mock.Anything, "new-team/_folder.json", "ref-new").
			Return(&repository.FileInfo{Data: metaJSON}, nil)

		tree := NewEmptyFolderTree()
		tree.Add(Folder{ID: "stable-uid", Title: "My Folder", Path: "old-team/"}, "")

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "My Folder", config.Name), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		oldID, err := fm.RenameFolderPath(ctx, "old-team/", "ref-old", "new-team/", "ref-new")
		require.NoError(t, err)
		require.Empty(t, oldID, "same UID means in-place update, no cleanup needed")
	})

	t.Run("same stable UID preserves folder and descendants in tree", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		metaJSON := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"My Folder"}}`)
		rw.On("Read", mock.Anything, "old-team/_folder.json", "ref-old").
			Return(&repository.FileInfo{Data: metaJSON}, nil)
		rw.On("Read", mock.Anything, "new-team/_folder.json", "ref-new").
			Return(&repository.FileInfo{Data: metaJSON}, nil)

		tree := NewEmptyFolderTree()
		tree.Add(Folder{ID: "stable-uid", Title: "My Folder", Path: "old-team/"}, "")
		tree.Add(Folder{ID: "child-folder", Title: "Child", Path: "old-team/sub/"}, "stable-uid")

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "My Folder", config.Name), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		oldID, err := fm.RenameFolderPath(ctx, "old-team/", "ref-old", "new-team/", "ref-new")
		require.NoError(t, err)
		require.Empty(t, oldID)

		_, parentExists := tree.Get("stable-uid")
		require.True(t, parentExists, "renamed folder must remain in tree for same-UID move")

		_, childExists := tree.Get("child-folder")
		require.True(t, childExists, "descendant folder must remain in tree for same-UID move")
	})

	t.Run("different UIDs returns old folder ID for cleanup", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		oldMeta := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"old-uid"},"spec":{"title":"Old"}}`)
		newMeta := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"new-uid"},"spec":{"title":"New"}}`)
		rw.On("Read", mock.Anything, "old-team/_folder.json", "ref-old").
			Return(&repository.FileInfo{Data: oldMeta}, nil)
		rw.On("Read", mock.Anything, "new-team/_folder.json", "ref-new").
			Return(&repository.FileInfo{Data: newMeta}, nil)

		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{}, name)
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		oldID, err := fm.RenameFolderPath(ctx, "old-team/", "ref-old", "new-team/", "ref-new")
		require.NoError(t, err)
		require.Equal(t, "old-uid", oldID, "different UIDs means old folder needs cleanup")
	})

	t.Run("no metadata uses hash-based IDs which always differ on rename", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		tree := NewEmptyFolderTree()

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, apierrors.NewNotFound(schema.GroupResource{}, name)
			},
			createFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind)
		oldID, err := fm.RenameFolderPath(ctx, "old-team/", "ref-old", "new-team/", "ref-new")
		require.NoError(t, err)

		oldFolder := ParseFolder("old-team/", config.Name)
		require.Equal(t, oldFolder.ID, oldID, "hash-based IDs differ on rename, old ID returned for cleanup")
	})

	t.Run("error parsing old folder propagates", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "bad-folder/_folder.json", "ref").
			Return(nil, fmt.Errorf("disk error"))

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), FolderKind, WithFolderMetadataEnabled(true))
		_, err := fm.RenameFolderPath(ctx, "bad-folder/", "ref", "new-folder/", "ref")
		require.Error(t, err)
		require.ErrorContains(t, err, "parse old folder")
	})

	t.Run("error ensuring new path propagates", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "old-team/_folder.json", "ref-old").
			Return(nil, repository.ErrFileNotFound)
		rw.On("Read", mock.Anything, "new-team/_folder.json", "ref-new").
			Return(nil, repository.ErrFileNotFound)

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return nil, fmt.Errorf("server error")
			},
		}

		tree := NewEmptyFolderTree()
		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))
		_, err := fm.RenameFolderPath(ctx, "old-team/", "ref-old", "new-team/", "ref-new")
		require.Error(t, err)
		require.ErrorContains(t, err, "ensure new folder path")
	})

	t.Run("ancestor relocation opts bypass UID conflict for parent folder", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		parentMeta := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"parent-uid"},"spec":{"title":"Parent"}}`)
		childMeta := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"child-uid"},"spec":{"title":"Child"}}`)

		rw.On("Read", mock.Anything, "old-parent/child/_folder.json", "ref-old").
			Return(&repository.FileInfo{Data: childMeta}, nil)
		rw.On("Read", mock.Anything, "new-parent/_folder.json", "ref-new").
			Return(&repository.FileInfo{Data: parentMeta}, nil)
		rw.On("Read", mock.Anything, "new-parent/child/_folder.json", "ref-new").
			Return(&repository.FileInfo{Data: childMeta}, nil)

		tree := NewEmptyFolderTree()
		tree.Add(Folder{ID: "parent-uid", Title: "Parent", Path: "old-parent/"}, "")
		tree.Add(Folder{ID: "child-uid", Title: "Child", Path: "old-parent/child/"}, "parent-uid")

		client := &fakeDynamicResourceClient{
			getFn: func(name string) (*unstructured.Unstructured, error) {
				return managedFolder(name, "title", config.Name), nil
			},
			updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				return obj, nil
			},
		}

		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))

		// Without WithRelocatingUIDs("parent-uid"), this would fail because
		// parent-uid is still registered at old-parent/ in the tree.
		oldID, err := fm.RenameFolderPath(ctx, "old-parent/child/", "ref-old", "new-parent/child/", "ref-new",
			WithRelocatingUIDs("parent-uid"))
		require.NoError(t, err)
		require.Empty(t, oldID, "same UID means in-place update, no cleanup needed")
	})

	t.Run("nested folder rename without ancestor relocation opts fails on UID conflict", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		parentMeta := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"parent-uid"},"spec":{"title":"Parent"}}`)
		childMeta := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"child-uid"},"spec":{"title":"Child"}}`)

		rw.On("Read", mock.Anything, "old-parent/child/_folder.json", "ref-old").
			Return(&repository.FileInfo{Data: childMeta}, nil)
		rw.On("Read", mock.Anything, "new-parent/child/_folder.json", "ref-new").
			Return(&repository.FileInfo{Data: childMeta}, nil)
		rw.On("Read", mock.Anything, "new-parent/_folder.json", "ref-new").
			Return(&repository.FileInfo{Data: parentMeta}, nil)

		tree := NewEmptyFolderTree()
		tree.Add(Folder{ID: "parent-uid", Title: "Parent", Path: "old-parent/"}, "")
		tree.Add(Folder{ID: "child-uid", Title: "Child", Path: "old-parent/child/"}, "parent-uid")

		fm := NewFolderManager(rw, &fakeDynamicResourceClient{}, tree, FolderKind, WithFolderMetadataEnabled(true))

		// Without ancestor relocation opts, EnsureFolderPathExist rejects the
		// parent UID appearing at a new path.
		_, err := fm.RenameFolderPath(ctx, "old-parent/child/", "ref-old", "new-parent/child/", "ref-new")
		require.Error(t, err)
		require.ErrorContains(t, err, "already used by folder")
	})
}

// TestEnsureFolderPathExist_EarlyReturnCheckIDConflict covers the conflict check
// at root folder check..
func TestEnsureFolderPathExist_EarlyReturnCheckIDConflict(t *testing.T) {
	ctx := context.Background()

	folderJSON := func(uid, title string) []byte {
		return []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"` + uid + `"},"spec":{"title":"` + title + `"}}`)
	}

	t.Run("returns error when hash matches but folder is registered under a different path", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		// Pre-walk reads "my-folder/_folder.json" — returns a stable UID and hash.
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
			Return(&repository.FileInfo{
				Data: folderJSON("shared-uid", "My Folder"),
				Hash: "same-hash",
			}, nil)

		// The tree already has "shared-uid" with the SAME hash but under a DIFFERENT path.
		tree := NewEmptyFolderTree()
		tree.Add(Folder{
			ID:           "shared-uid",
			Path:         "other-folder",
			Title:        "Other Folder",
			MetadataHash: "same-hash", // identical hash triggers the early-return branch
		}, "")

		client := &fakeDynamicResourceClient{}
		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))

		_, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")

		require.Error(t, err)
		var validationErr *ResourceValidationError
		require.ErrorAs(t, err, &validationErr, "conflict from early-return branch must be a ResourceValidationError")
		require.ErrorContains(t, err, "shared-uid")
		require.ErrorContains(t, err, "my-folder")
		require.ErrorContains(t, err, "other-folder")
		// No folder creation should have been attempted.
		require.Empty(t, client.getCalls)
		require.Empty(t, client.createCalls)
	})

	t.Run("returns folder ID without API calls when hash and path both match", func(t *testing.T) {
		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "test-ref").
			Return(&repository.FileInfo{
				Data: folderJSON("stable-uid", "My Folder"),
				Hash: "same-hash",
			}, nil)

		tree := NewEmptyFolderTree()
		tree.Add(Folder{
			ID:           "stable-uid",
			Path:         "my-folder",
			Title:        "My Folder",
			MetadataHash: "same-hash",
		}, "")

		client := &fakeDynamicResourceClient{}
		fm := NewFolderManager(rw, client, tree, FolderKind, WithFolderMetadataEnabled(true))

		parent, err := fm.EnsureFolderPathExist(ctx, "my-folder/dashboard.json", "test-ref")

		require.NoError(t, err)
		require.Equal(t, "stable-uid", parent)
		// Early-return path must not call any Kubernetes API.
		require.Empty(t, client.getCalls, "no GET should be made when hash and path already match")
		require.Empty(t, client.createCalls)
	})
}
