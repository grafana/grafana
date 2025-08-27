package resources

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

var (
	ErrAlreadyInRepository = errors.New("already in repository")
	ErrDuplicateName       = errors.New("duplicate name in repository")
	ErrMissingName         = field.Required(field.NewPath("name", "metadata", "name"), "missing name in resource")
)

// NewResourceOwnershipConflictError creates a BadRequest error for when a resource
// is owned by a different repository or manager and cannot be modified
func NewResourceOwnershipConflictError(resourceName string, currentManager utils.ManagerProperties, requestingManager utils.ManagerProperties) error {
	message := fmt.Sprintf("resource '%s' is managed by %s '%s' and cannot be modified by %s '%s'",
		resourceName,
		currentManager.Kind,
		currentManager.Identity,
		requestingManager.Kind,
		requestingManager.Identity)

	return apierrors.NewBadRequest(message)
}

type WriteOptions struct {
	Path string
	Ref  string
}

type resourceID struct {
	Name     string
	Resource string
	Group    string
}

type ResourcesManager struct {
	repo            repository.ReaderWriter
	folders         *FolderManager
	parser          Parser
	clients         ResourceClients
	resourcesLookup map[resourceID]string // the path with this k8s name
}

func NewResourcesManager(repo repository.ReaderWriter, folders *FolderManager, parser Parser, clients ResourceClients) *ResourcesManager {
	return &ResourcesManager{
		repo:            repo,
		folders:         folders,
		parser:          parser,
		clients:         clients,
		resourcesLookup: map[resourceID]string{},
	}
}

// CheckResourceOwnership validates that the requesting manager can modify the existing resource
// Returns an error if the existing resource is owned by a different manager that doesn't allow edits
// If existingResource is nil, no ownership conflict exists (new resource)
// This is a package-level function that can be used without a ResourcesManager instance
func CheckResourceOwnership(existingResource *unstructured.Unstructured, resourceName string, requestingManager utils.ManagerProperties) error {
	if existingResource == nil {
		// Resource doesn't exist, so no ownership conflict
		return nil
	}

	// Check if the existing resource has manager properties
	existingMeta, err := utils.MetaAccessor(existingResource)
	if err != nil {
		// If we can't get metadata, allow the operation
		return nil
	}

	currentManager, hasManager := existingMeta.GetManagerProperties()
	if !hasManager {
		// No manager information, so no ownership conflict
		return nil
	}

	// Check if this is the same manager
	if currentManager.Kind == requestingManager.Kind && currentManager.Identity == requestingManager.Identity {
		// Same manager, no conflict
		return nil
	}

	// Check if the current manager allows edits
	if currentManager.AllowsEdits {
		// Manager allows edits from others, no conflict
		return nil
	}

	// Different manager and edits not allowed - return ownership conflict error
	return NewResourceOwnershipConflictError(resourceName, currentManager, requestingManager)
}

// CreateResource writes an object to the repository
func (r *ResourcesManager) WriteResourceFileFromObject(ctx context.Context, obj *unstructured.Unstructured, options WriteOptions) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", fmt.Errorf("context error: %w", err)
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return "", fmt.Errorf("extract meta accessor: %w", err)
	}

	// Message from annotations
	commitMessage := meta.GetMessage()
	if commitMessage == "" {
		g := meta.GetGeneration()
		if g > 0 {
			commitMessage = fmt.Sprintf("Generation: %d", g)
		} else {
			commitMessage = "exported from grafana"
		}
	}

	name := meta.GetName()
	if name == "" {
		return "", ErrMissingName
	}

	manager, _ := meta.GetManagerProperties()
	// TODO: how should we handle this?
	if manager.Identity == r.repo.Config().GetName() {
		// If it's already in the repository, we don't need to write it
		return "", ErrAlreadyInRepository
	}

	title := meta.FindTitle("")
	if title == "" {
		title = name
	}

	folder := meta.GetFolder()
	// Get the absolute path of the folder
	rootFolder := RootFolder(r.repo.Config())

	// If no folder is specified in the file, set it to the root to ensure everything is written under it
	var fid Folder
	if folder == "" {
		fid = Folder{ID: rootFolder}
		meta.SetFolder(rootFolder) // Set the folder in the metadata to the root folder
	} else {
		var ok bool
		fid, ok = r.folders.Tree().DirPath(folder, rootFolder)
		if !ok {
			return "", fmt.Errorf("folder %s NOT found in tree with root: %s", folder, rootFolder)
		}
	}

	fileName := slugify.Slugify(title) + ".json"
	if fid.Path != "" {
		fileName = safepath.Join(fid.Path, fileName)
	}

	if options.Path != "" {
		fileName = safepath.Join(options.Path, fileName)
	}

	parsed := ParsedResource{
		Info: &repository.FileInfo{
			Path: fileName,
			Ref:  options.Ref,
		},
		Obj: obj,
	}
	body, err := parsed.ToSaveBytes()
	if err != nil {
		return "", err
	}

	err = r.repo.Write(ctx, fileName, options.Ref, body, commitMessage)
	if err != nil {
		return "", fmt.Errorf("failed to write file: %s, %w", fileName, err)
	}

	return fileName, nil
}

func (r *ResourcesManager) WriteResourceFromFile(ctx context.Context, path string, ref string) (string, schema.GroupVersionKind, error) {
	// Read the referenced file
	fileInfo, err := r.repo.Read(ctx, path, ref)
	if err != nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("failed to read file: %w", err)
	}

	parsed, err := r.parser.Parse(ctx, fileInfo)
	if err != nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("failed to parse file: %w", err)
	}

	if parsed.Obj.GetName() == "" {
		return "", schema.GroupVersionKind{}, ErrMissingName
	}

	// Check if the resource already exists
	id := resourceID{
		Name:     parsed.Obj.GetName(),
		Resource: parsed.GVR.Resource,
		Group:    parsed.GVK.Group,
	}
	existing, found := r.resourcesLookup[id]
	if found {
		return "", parsed.GVK, fmt.Errorf("duplicate resource name: %s, %s and %s: %w", parsed.Obj.GetName(), path, existing, ErrDuplicateName)
	}
	r.resourcesLookup[id] = path

	// For resources that exist in folders, set the header annotation
	if slices.Contains(SupportsFolderAnnotation, parsed.GVR.GroupResource()) {
		// Make sure the parent folders exist
		folder, err := r.folders.EnsureFolderPathExist(ctx, path)
		if err != nil {
			return "", parsed.GVK, fmt.Errorf("failed to ensure folder path exists: %w", err)
		}
		parsed.Meta.SetFolder(folder)
	}

	// Clear any saved identifiers
	parsed.Meta.SetUID("")
	parsed.Meta.SetResourceVersion("")

	err = parsed.Run(ctx)

	return parsed.Obj.GetName(), parsed.GVK, err
}

func (r *ResourcesManager) RenameResourceFile(ctx context.Context, previousPath, previousRef, newPath, newRef string) (string, schema.GroupVersionKind, error) {
	name, gvk, err := r.RemoveResourceFromFile(ctx, previousPath, previousRef)
	if err != nil {
		return name, gvk, fmt.Errorf("failed to remove resource: %w", err)
	}

	return r.WriteResourceFromFile(ctx, newPath, newRef)
}

func (r *ResourcesManager) RemoveResourceFromFile(ctx context.Context, path string, ref string) (string, schema.GroupVersionKind, error) {
	info, err := r.repo.Read(ctx, path, ref)
	if err != nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("failed to read file: %w", err)
	}

	obj, gvk, _ := DecodeYAMLObject(bytes.NewBuffer(info.Data))
	if obj == nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("no object found")
	}

	objName := obj.GetName()
	if objName == "" {
		return "", schema.GroupVersionKind{}, ErrMissingName
	}

	client, _, err := r.clients.ForKind(*gvk)
	if err != nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("unable to get client for deleted object: %w", err)
	}

	err = client.Delete(ctx, objName, metav1.DeleteOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return objName, schema.GroupVersionKind{}, nil // Already deleted or simply non-existing, nothing to do
		}

		return "", schema.GroupVersionKind{}, fmt.Errorf("failed to delete: %w", err)
	}

	return objName, schema.GroupVersionKind{}, nil
}
