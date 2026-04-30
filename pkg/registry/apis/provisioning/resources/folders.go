package resources

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

const MaxNumberOfFolders = 10000

// EnsurePathOption configures the behaviour of EnsureFolderPathExist.
type EnsurePathOption func(*ensurePathConfig)

type ensurePathConfig struct {
	relocatingUIDs map[string]struct{}
	forceWalk      bool
}

func newEnsurePathConfig(opts []EnsurePathOption) ensurePathConfig {
	cfg := ensurePathConfig{relocatingUIDs: make(map[string]struct{})}
	for _, opt := range opts {
		opt(&cfg)
	}
	return cfg
}

func (c *ensurePathConfig) isRelocating(uid string) bool {
	_, ok := c.relocatingUIDs[uid]
	return ok
}

// WithRelocatingUIDs marks UIDs as legitimately relocating to a new path so
// that the ID conflict check is bypassed for them during folder path resolution.
// This avoids mutating the tree before the operation is confirmed to succeed.
func WithRelocatingUIDs(uids ...string) EnsurePathOption {
	return func(cfg *ensurePathConfig) {
		for _, uid := range uids {
			cfg.relocatingUIDs[uid] = struct{}{}
		}
	}
}

// WithForceWalk skips the early-return optimisation so that the full ancestor
// walk always runs. Use this when the caller knows that the tree entry may be
// stale (e.g. parent-only changes during full sync).
func WithForceWalk() EnsurePathOption {
	return func(cfg *ensurePathConfig) {
		cfg.forceWalk = true
	}
}

// PathCreationError represents an error that occurred while creating a folder path.
// It contains the path that failed and the underlying error.
type PathCreationError struct {
	Path string
	Err  error
}

func (e *PathCreationError) Unwrap() error {
	return e.Err
}

func (e *PathCreationError) Error() string {
	return fmt.Sprintf("failed to create path %s: %v", e.Path, e.Err)
}

// FolderCreationInterceptor is called before a folder is created during path
// traversal. Return an error to prevent the folder from being created.
type FolderCreationInterceptor func(ctx context.Context, folder Folder) error

type FolderManagerOption func(*FolderManager)

type FolderManager struct {
	repo                  repository.ReaderWriter
	tree                  FolderTree
	client                dynamic.ResourceInterface
	beforeCreate          FolderCreationInterceptor
	folderMetadataEnabled bool
	folderGVK             schema.GroupVersionKind
}

func NewFolderManager(repo repository.ReaderWriter, client dynamic.ResourceInterface, lookup FolderTree, folderGVK schema.GroupVersionKind, opts ...FolderManagerOption) *FolderManager {
	fm := &FolderManager{
		repo:      repo,
		tree:      lookup,
		client:    client,
		folderGVK: folderGVK,
		beforeCreate: func(context.Context, Folder) error {
			return nil
		},
	}
	for _, opt := range opts {
		opt(fm)
	}
	return fm
}

func (fm *FolderManager) FolderGVK() schema.GroupVersionKind {
	return fm.folderGVK
}

func WithBeforeCreate(beforeCreate FolderCreationInterceptor) FolderManagerOption {
	return func(fm *FolderManager) {
		fm.beforeCreate = beforeCreate
	}
}

func WithFolderMetadataEnabled(folderMetadataEnabled bool) FolderManagerOption {
	return func(fm *FolderManager) {
		fm.folderMetadataEnabled = folderMetadataEnabled
	}
}

func (fm *FolderManager) Client() dynamic.ResourceInterface {
	return fm.client
}

func (fm *FolderManager) Tree() FolderTree {
	return fm.tree
}

func (fm *FolderManager) SetTree(tree FolderTree) {
	fm.tree = tree
}

// EnsureFolderPathExist creates the folder structure in the cluster.
func (fm *FolderManager) EnsureFolderPathExist(ctx context.Context, filePath, ref string, opts ...EnsurePathOption) (parent string, err error) {
	epCfg := newEnsurePathConfig(opts)
	cfg := fm.repo.Config()
	parent = RootFolder(cfg)

	dir := filePath
	if !safepath.IsDir(filePath) {
		dir = safepath.Dir(filePath)
	}

	if dir == "" {
		return parent, nil
	}

	f, err := fm.resolveFolderForPath(ctx, dir, ref)
	if err != nil {
		return "", err
	}

	// ParentID is only resolved during the walk below, so we skip it here
	// to avoid a false mismatch against the already-resolved tree entry.
	// Force walk is used to skip the early-return optimisation so that the full ancestor
	// walk always runs. Use this when the caller knows that the tree entry may be
	// stale (e.g. a folder was moved to a new path).
	if !epCfg.forceWalk {
		if existing, ok := fm.tree.Get(f.ID); ok && f.Equal(existing, IgnoreParent()) {
			// When a folder is being relocated, its UID temporarily exists at both the old
			// and new paths in the tree. Allow the duplicate UID only in that case.
			if !epCfg.isRelocating(f.ID) &&
				safepath.EnsureTrailingSlash(existing.Path) != safepath.EnsureTrailingSlash(f.Path) {
				return "", NewResourceValidationError(fmt.Errorf(
					"folder UID %q defined in %q is already used by folder at path %q",
					f.ID, f.Path, existing.Path,
				))
			}
			return f.ID, nil
		}
	}

	err = safepath.Walk(ctx, f.Path, func(ctx context.Context, traverse string) error {
		f, err := fm.resolveFolderForPath(ctx, traverse, ref)
		if err != nil {
			return err
		}
		f.ParentID = parent

		existing, existsInTree := fm.tree.Get(f.ID)
		if existsInTree && f.Equal(existing) {
			parent = f.ID
			return nil
		}

		if !epCfg.isRelocating(f.ID) && existsInTree &&
			safepath.EnsureTrailingSlash(existing.Path) != safepath.EnsureTrailingSlash(f.Path) {
			return NewResourceValidationError(fmt.Errorf(
				"folder UID %q defined in %q is already used by folder at path %q",
				f.ID, f.Path, existing.Path,
			))
		}
		if err := fm.EnsureFolderExists(ctx, f, parent); err != nil {
			return &PathCreationError{
				Path: f.Path,
				Err:  fmt.Errorf("ensure folder exists: %w", err),
			}
		}

		fm.tree.Add(f, parent)
		parent = f.ID
		return nil
	})

	if err != nil {
		return "", err
	}

	return f.ID, nil
}

// resolveFolderForPath parses folder metadata when possible. If metadata is
// invalid, it falls back to the current folder already known at that path. When
// no folder exists yet, it falls back to the hash/path-derived folder identity.
func (fm *FolderManager) resolveFolderForPath(ctx context.Context, path, ref string) (Folder, error) {
	f, err := ParseFolderWithMetadata(ctx, fm.repo, path, ref, fm.folderMetadataEnabled)
	if err == nil {
		return f, nil
	}

	var invalidErr *InvalidFolderMetadata
	if !errors.As(err, &invalidErr) {
		return Folder{}, err
	}

	if existing, ok := fm.tree.GetByPath(path); ok {
		return existing, nil
	}

	return ParseFolder(path, fm.repo.Config().Name), nil
}

// EnsureFolderExists creates the folder if it doesn't exist.
// If the folder already exists:
// - it will error if the folder is not owned by this repository
// - it will update metadata-backed properties if they have changed
func (fm *FolderManager) EnsureFolderExists(ctx context.Context, folder Folder, parent string) error {
	cfg := fm.repo.Config()
	obj, err := fm.client.Get(ctx, folder.ID, metav1.GetOptions{})
	if err == nil {
		current, ok := obj.GetAnnotations()[utils.AnnoKeyManagerIdentity]
		if !ok {
			return fmt.Errorf("target folder is not managed by a repository")
		}
		if current != cfg.Name {
			return fmt.Errorf("target folder is managed by a different repository (%s)", current)
		}

		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return fmt.Errorf("create meta accessor: %w", err)
		}

		currentTitle, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		source, _ := meta.GetSourceProperties()
		existing := Folder{
			Title:        currentTitle,
			Path:         source.Path,
			MetadataHash: source.Checksum,
			ParentID:     meta.GetFolder(),
		}

		if !folder.Equal(existing) {
			if err := unstructured.SetNestedField(obj.Object, folder.Title, "spec", "title"); err != nil {
				return fmt.Errorf("set folder title: %w", err)
			}
			meta.SetSourceProperties(utils.SourceProperties{
				Path:     folder.Path,
				Checksum: folder.MetadataHash,
			})
			meta.SetFolder(folder.ParentID)
			ctx, _, err = identity.WithProvisioningIdentity(ctx, cfg.GetNamespace())
			if err != nil {
				return fmt.Errorf("unable to use provisioning identity %w", err)
			}
			if _, err := fm.client.Update(ctx, obj, metav1.UpdateOptions{}); err != nil {
				// A managed folder being moved into a path that exceeds the
				// folder API's max depth is the same user-side problem as a
				// fresh create: surface it as a typed warning so the sync is
				// not retried in a loop.
				if IsFolderDepthExceededAPIError(err) {
					return NewFolderDepthExceededError(folder.Path, err)
				}
				// A managed folder ending up with a UID longer than 40 chars
				// (typically via _folder.json metadata) cannot be repaired by
				// a retry; surface it as a typed warning instead.
				if IsFolderUIDTooLongAPIError(err) {
					return NewFolderUIDTooLongError(folder.Path, folder.ID, err)
				}
				// Catch-all for any other folder-API validation 4xx
				// (illegal-uid-chars, reserved-uid, etc.). The repository
				// owner must fix the offending input; retrying produces
				// the same rejection.
				if IsFolderValidationAPIError(err) {
					return NewFolderValidationError(folder.Path, err)
				}
				return fmt.Errorf("update folder: %w", err)
			}
		}

		return nil
	} else if !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if folder exists: %w", err)
	}

	// Run creation guard only when the folder does not already exist.
	if err := fm.beforeCreate(ctx, folder); err != nil {
		return err
	}

	// Always use the provisioning identity when writing
	ctx, _, err = identity.WithProvisioningIdentity(ctx, cfg.GetNamespace())
	if err != nil {
		return fmt.Errorf("unable to use provisioning identity %w", err)
	}

	obj = &unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": map[string]any{
				"title": folder.Title,
			},
		},
	}
	obj.SetAPIVersion(fm.folderGVK.Group + "/" + fm.folderGVK.Version)
	obj.SetKind(fm.folderGVK.Kind)
	obj.SetNamespace(cfg.GetNamespace())
	obj.SetName(folder.ID)

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("create meta accessor for the object: %w", err)
	}

	if parent != "" {
		meta.SetFolder(parent)
	} else {
		meta.SetAnnotation(utils.AnnoKeyGrantPermissions, utils.AnnoGrantPermissionsDefault)
	}
	meta.SetManagerProperties(utils.ManagerProperties{
		Kind:     utils.ManagerKindRepo,
		Identity: cfg.GetName(),
	})
	meta.SetSourceProperties(utils.SourceProperties{
		Path:     folder.Path,
		Checksum: folder.MetadataHash,
	})

	if _, err := fm.client.Create(ctx, obj, metav1.CreateOptions{}); err != nil {
		// there is a potential race here where two syncs can be triggered
		// if we try to create and there is an error, check if it is from another sync
		// job for this repo that created it
		if apierrors.IsAlreadyExists(err) || err.Error() == dashboards.ErrFolderVersionMismatch.Error() {
			obj, err2 := fm.client.Get(ctx, folder.ID, metav1.GetOptions{})
			if err2 != nil {
				return fmt.Errorf("failed to get folder: %w", err2)
			} else if obj == nil {
				return fmt.Errorf("failed to create folder: %w", err)
			}

			current, ok := obj.GetAnnotations()[utils.AnnoKeyManagerIdentity]
			if !ok {
				return fmt.Errorf("target folder is not managed by a repository")
			}
			if current != cfg.Name {
				return fmt.Errorf("target folder is managed by a different repository (%s)", current)
			}

			return nil
		}

		// The folder API enforces a global maximum folder depth that
		// provisioning cannot influence. Repositories containing paths
		// deeper than this limit will fail forever, so surface it as a
		// typed warning instead of a retryable error and let the sync
		// keep going for the rest of the tree.
		if IsFolderDepthExceededAPIError(err) {
			return NewFolderDepthExceededError(folder.Path, err)
		}
		// Same reasoning as depth above: a UID longer than the folder
		// API's 40-character limit is a permanent rejection. Path-derived
		// UIDs are always truncated to <=40 by appendHashSuffix, so this
		// only fires for user-supplied UIDs (typically a _folder.json
		// stable UID, but also any future caller-provided UID source).
		// Surface it as a typed warning so the sync moves on.
		if IsFolderUIDTooLongAPIError(err) {
			return NewFolderUIDTooLongError(folder.Path, folder.ID, err)
		}
		// Catch-all for any other folder-API validation 4xx the more
		// specific matchers above did not claim (illegal-uid-chars,
		// reserved-uid, future folder validations). The repository owner
		// must fix the offending input; retrying produces the same
		// rejection.
		if IsFolderValidationAPIError(err) {
			return NewFolderValidationError(folder.Path, err)
		}

		return fmt.Errorf("failed to create folder: %w", err)
	}
	return nil
}

func (fm *FolderManager) GetFolder(ctx context.Context, name string) (*unstructured.Unstructured, error) {
	return fm.client.Get(ctx, name, metav1.GetOptions{})
}

// CreateFolderWithUID creates a Grafana folder using a caller-provided stable UID
// instead of the path-derived hash UID produced by ParseFolder.
// It ensures all ancestor folders exist first, then creates the leaf folder.
// Used when _folder.json has already been written to the repository.
func (fm *FolderManager) CreateFolderWithUID(ctx context.Context, folderPath, stableUID, ref string) error {
	cfg := fm.repo.Config()

	// Determine the parent folder ID, ensuring ancestor folders exist.
	parentPath := safepath.Dir(folderPath)
	var parentFolderID string
	if parentPath == "" {
		parentFolderID = RootFolder(cfg)
	} else {
		var err error
		parentFolderID, err = fm.EnsureFolderPathExist(ctx, parentPath, ref)
		if err != nil {
			return fmt.Errorf("ensure parent folder path: %w", err)
		}
	}

	// Build the leaf folder struct but replace the hash-derived ID with the stable UID.
	leaf := ParseFolder(folderPath, cfg.GetName())
	leaf.ID = stableUID
	leaf.ParentID = parentFolderID

	return fm.EnsureFolderExists(ctx, leaf, parentFolderID)
}

// RemoveFolderFromTree removes the folder and all its descendants from the in-memory tree.
func (fm *FolderManager) RemoveFolderFromTree(folderID string) {
	fm.tree.Remove(folderID)
}

func (fm *FolderManager) RemoveFolder(ctx context.Context, name string) error {
	return fm.client.Delete(ctx, name, metav1.DeleteOptions{})
}

// RenameFolderPath handles a directory rename during incremental sync.
// For metadata-backed folders (stable UID), the existing K8s object is
// updated in place and an empty string is returned (no cleanup needed).
// For non-metadata folders the UID changes, so a new folder is created
// at newPath and the old folder ID is returned for cleanup.
//
// Invalid `_folder.json` does not abort the rename. For the old path we fall
// back to the existing folder in the seeded tree (or to the path-derived UID if
// there is no tree entry), and for the new path we fall back to the
// path-derived UID. That gives delete+recreate semantics instead of preserving
// a metadata-backed identity we can no longer trust.
func (fm *FolderManager) RenameFolderPath(ctx context.Context, previousPath, previousRef, newPath, newRef string, opts ...EnsurePathOption) (string, error) {
	oldFolder, err := ParseFolderWithMetadata(ctx, fm.repo, previousPath, previousRef, fm.folderMetadataEnabled)
	if err != nil {
		var invalidErr *InvalidFolderMetadata
		if !errors.As(err, &invalidErr) {
			return "", fmt.Errorf("parse old folder: %w", err)
		}

		// Invalid old metadata means we cannot trust a metadata-backed identity for
		// the source path. Reuse the seeded-tree entry when available so follow-up
		// child reconciliation keeps pointing at the currently managed folder.
		if existing, ok := fm.tree.GetByPath(previousPath); ok {
			oldFolder = existing
		} else {
			oldFolder = ParseFolder(previousPath, fm.repo.Config().Name)
		}
	}

	// Pass the old UID as relocating so the ID conflict check does not reject
	// the same stable UID appearing at a new path. The tree is only mutated
	// after EnsureFolderPathExist succeeds, avoiding tree corruption on failure.
	ensureOpts := append([]EnsurePathOption{WithRelocatingUIDs(oldFolder.ID)}, opts...)
	if _, err := fm.EnsureFolderPathExist(ctx, newPath, newRef, ensureOpts...); err != nil {
		return "", fmt.Errorf("ensure new folder path: %w", err)
	}

	newFolder, err := ParseFolderWithMetadata(ctx, fm.repo, newPath, newRef, fm.folderMetadataEnabled)
	if err != nil {
		var invalidErr *InvalidFolderMetadata
		if !errors.As(err, &invalidErr) {
			return "", fmt.Errorf("parse new folder: %w", err)
		}

		// Invalid new metadata means the destination cannot claim a stable
		// metadata-defined UID, so the rename degrades to the normal path-derived
		// folder identity at newPath.
		newFolder = ParseFolder(newPath, fm.repo.Config().Name)
	}

	if oldFolder.ID == newFolder.ID {
		// Same UID — metadata-preserving move. EnsureFolderPathExist already
		// updated the tree entry to the new path; nothing to clean up.
		return "", nil
	}

	return oldFolder.ID, nil
}

// EnsureFolderTreeExists replicates the folder tree to the repository.
// The function fn is called for each folder.
// If the folder already exists, the function is called with created set to false.
// If the folder is created, the function is called with created set to true.
func (fm *FolderManager) EnsureFolderTreeExists(ctx context.Context, ref, path string, tree FolderTree, fn func(folder Folder, created bool, err error) error) error {
	return tree.Walk(ctx, func(ctx context.Context, folder Folder, parent string) error {
		p := folder.Path
		if path != "" {
			p = safepath.Join(path, p)
		}
		if !safepath.IsDir(p) {
			p = p + "/" // trailing slash indicates folder
		}

		_, err := fm.repo.Read(ctx, p, ref)
		if err != nil && (!errors.Is(err, repository.ErrFileNotFound) && !apierrors.IsNotFound(err)) {
			return fn(folder, false, fmt.Errorf("check if folder exists before writing: %w", err))
		} else if err == nil {
			// Folder already exists in repository, add it to tree so resources can find it
			fm.tree.Add(folder, parent)
			return fn(folder, false, nil)
		}

		if fm.folderMetadataEnabled {
			msg := fmt.Sprintf("Add folder and folder metadata %s", p)
			manifest := NewFolderManifest(folder.ID, folder.Title, fm.folderGVK)
			if _, err := WriteFolderMetadata(ctx, fm.repo, p, manifest, ref, msg); err != nil {
				return fn(folder, true, err)
			}
		} else {
			msg := fmt.Sprintf("Add folder %s", p)
			if err := fm.repo.Create(ctx, p, ref, nil, msg); err != nil {
				return fn(folder, true, fmt.Errorf("write folder in repo: %w", err))
			}
		}
		// Add it to the existing tree
		fm.tree.Add(folder, parent)

		return fn(folder, true, nil)
	})
}
