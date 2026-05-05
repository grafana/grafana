package resources

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
)

var (
	ErrAlreadyInRepository = errors.New("already in repository")
	ErrDuplicateName       = errors.New("duplicate name in repository")
	ErrMissingName         = field.Required(field.NewPath("name", "metadata", "name"), "missing name in resource")
)

// wrapAsValidationErrorIfNeeded wraps certain errors as ResourceValidationError
// to treat them as warnings rather than hard errors. This includes:
//   - Kubernetes field validation errors
//   - Kubernetes API BadRequest errors (which often wrap dashboard/resource validation errors)
//   - Kubernetes API Invalid errors (StatusReasonInvalid, HTTP 422)
//   - Dashboard validation errors (all DashboardErr types)
//   - Duplicate resource errors
//   - Resource already in repository errors
func wrapAsValidationErrorIfNeeded(err error) error {
	if err == nil {
		return nil
	}

	// Check if it's already a validation error
	var validationErr *ResourceValidationError
	if errors.As(err, &validationErr) {
		return err
	}

	// Check if it's a field validation error (e.g., missing name)
	var fieldErr *field.Error
	if errors.As(err, &fieldErr) {
		return NewResourceValidationError(err)
	}

	// Check if it's a Kubernetes API validation-shaped error:
	//   - BadRequest (400): generic validation failure; the dashboard API
	//     also wraps some of its validation errors as BadRequest.
	//   - Invalid (422, StatusReasonInvalid): field.ErrorList-based
	//     rejections, e.g. CUE schema mismatches and immutable-field
	//     violations.
	if apierrors.IsBadRequest(err) || apierrors.IsInvalid(err) {
		return NewResourceValidationError(err)
	}

	// Check if it's a dashboard validation error (wrap all dashboard errors as validation errors)
	var dashboardErr dashboardaccess.DashboardErr
	if errors.As(err, &dashboardErr) {
		return NewResourceValidationError(err)
	}

	// Check if it's a duplicate name error or already in repository error
	if errors.Is(err, ErrDuplicateName) || errors.Is(err, ErrAlreadyInRepository) {
		return NewResourceValidationError(err)
	}

	return err
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
	mu              sync.RWMutex
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

// findResource checks if a resource exists in the lookup map (read operation)
func (r *ResourcesManager) findResource(id resourceID) (string, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	path, found := r.resourcesLookup[id]
	return path, found
}

func (r *ResourcesManager) addResource(id resourceID, path string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, found := r.resourcesLookup[id]; found {
		return
	}

	r.resourcesLookup[id] = path
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
			// HACK: this is a hack to get the folder path without the root folder
			// TODO: should we build the tree in a different way?
			fid, ok = r.folders.Tree().DirPath(folder, "")
			if !ok {
				return "", fmt.Errorf("folder %s NOT found in tree", folder)
			}
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
	readCtx, readSpan := tracing.Start(ctx, "provisioning.resources.write_resource_from_file.read_file")
	fileInfo, err := r.repo.Read(readCtx, path, ref)
	if err != nil {
		readSpan.RecordError(err)
		readSpan.End()
		return "", schema.GroupVersionKind{}, fmt.Errorf("failed to read file: %w", err)
	}
	readSpan.End()

	parseCtx, parseSpan := tracing.Start(ctx, "provisioning.resources.write_resource_from_file.parse_file")
	parsed, err := r.parser.Parse(parseCtx, fileInfo)
	if err != nil {
		parseSpan.RecordError(err)
		parseSpan.End()
		return "", schema.GroupVersionKind{}, fmt.Errorf("failed to parse file: %w", err)
	}
	parseSpan.End()

	return r.writeResourceFromParsed(ctx, path, ref, parsed)
}

func (r *ResourcesManager) writeResourceFromParsed(ctx context.Context, path, ref string, parsed *ParsedResource, folderOpts ...EnsurePathOption) (string, schema.GroupVersionKind, error) {
	if parsed.Obj.GetName() == "" {
		return "", schema.GroupVersionKind{}, NewResourceValidationError(ErrMissingName)
	}

	// Check if the resource already exists
	id := resourceID{
		Name:     parsed.Obj.GetName(),
		Resource: parsed.GVR.Resource,
		Group:    parsed.GVK.Group,
	}

	if existing, found := r.findResource(id); found {
		return "", parsed.GVK, NewResourceValidationError(
			fmt.Errorf("duplicate resource name: %s, %s and %s: %w", parsed.Obj.GetName(), path, existing, ErrDuplicateName),
		)
	}
	r.addResource(id, path)

	// For resources that exist in folders, set the header annotation
	if slices.Contains(SupportsFolderAnnotation, parsed.GVR.GroupResource()) {
		// Make sure the parent folders exist.
		// For _folder.json the resource IS the folder, so its parent is one level above.
		folderPath := path
		if IsFolderMetadataFile(path) {
			folderPath = safepath.Dir(safepath.Dir(path))
		}
		folderCtx, folderSpan := tracing.Start(ctx, "provisioning.resources.write_resource_from_file.ensure_folder")
		folder, err := r.folders.EnsureFolderPathExist(folderCtx, folderPath, ref, folderOpts...)
		if err != nil {
			folderSpan.RecordError(err)
			folderSpan.End()
			return "", parsed.GVK, fmt.Errorf("failed to ensure folder path exists: %w", err)
		}
		parsed.Meta.SetFolder(folder)
		folderSpan.End()
	}

	// Clear any saved identifiers
	parsed.Meta.SetUID("")
	parsed.Meta.SetResourceVersion("")

	runCtx, runSpan := tracing.Start(ctx, "provisioning.resources.write_resource_from_file.run_resource")
	err := parsed.Run(runCtx)
	if err != nil {
		runSpan.RecordError(err)
		// Wrap resource validation errors (like dashboard refresh interval) as warnings
		err = wrapAsValidationErrorIfNeeded(err)
	}
	runSpan.End()

	return parsed.Obj.GetName(), parsed.GVK, err
}

// ReplaceResourceFromFile writes a resource from file and, if the resource name
// changed compared to oldName, deletes the old resource to prevent orphans.
// Used by full sync where the old identity is known from Changes().Existing.
func (r *ResourcesManager) ReplaceResourceFromFile(ctx context.Context, path, ref string, oldName string, oldGVR schema.GroupVersionResource) (string, schema.GroupVersionKind, error) {
	newName, gvk, err := r.WriteResourceFromFile(ctx, path, ref)
	if err != nil || oldName == "" || oldName == newName {
		return newName, gvk, err
	}

	return newName, gvk, r.deleteOldResource(ctx, path, oldName, oldGVR, newName)
}

// ReplaceResourceFromFileByRef writes a resource from the file at path/ref and,
// if the resource identity changed compared to the previous version at
// path/previousRef, deletes the old resource to prevent orphans.
// Used by incremental sync where the previous git ref is available.
func (r *ResourcesManager) ReplaceResourceFromFileByRef(ctx context.Context, path, ref, previousRef string) (string, schema.GroupVersionKind, error) {
	oldInfo, err := r.repo.Read(ctx, path, previousRef)
	if err != nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("reading previous file: %w", err)
	}

	oldParsed, err := r.parser.Parse(ctx, oldInfo)
	if err != nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("parsing previous file: %w", err)
	}

	newName, gvk, writeErr := r.WriteResourceFromFile(ctx, path, ref)
	if writeErr != nil {
		return newName, gvk, writeErr
	}

	oldName := oldParsed.Obj.GetName()
	if oldName == "" || oldName == newName {
		return newName, gvk, nil
	}

	return newName, gvk, r.deleteOldResource(ctx, path, oldName, oldParsed.GVR, newName)
}

// deleteOldResource deletes the previous resource when a name change is
// detected. It sets the provisioning identity, checks ownership, and
// calls the client directly.
//
// The sourcePath parameter is the file path that triggered the replacement.
// Before deleting, we verify that the existing resource's sourcePath annotation
// still points to this file. If another file in the same sync has already
// written a resource with the same UID (e.g. a multi-file UID swap), the
// annotation will reference the other file and we skip the delete.
func (r *ResourcesManager) deleteOldResource(ctx context.Context, sourcePath, oldName string, oldGVR schema.GroupVersionResource, newName string) error {
	client, _, err := r.clients.ForResource(ctx, oldGVR)
	if err != nil {
		return fmt.Errorf("wrote new resource %s but failed to delete old resource %s: %w", newName, oldName, err)
	}

	cfg := r.repo.Config()

	ctx, _, err = identity.WithProvisioningIdentity(ctx, cfg.GetNamespace())
	if err != nil {
		return fmt.Errorf("unable to use provisioning identity: %w", err)
	}

	existing, err := client.Get(ctx, oldName, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil
		}
		return fmt.Errorf("wrote new resource %s but failed to delete old resource %s: %w", newName, oldName, err)
	}

	if currentPath := existing.GetAnnotations()[utils.AnnoKeySourcePath]; currentPath != "" && currentPath != sourcePath {
		return fmt.Errorf("skipping delete of old resource %s: now managed by %s, not %s", oldName, currentPath, sourcePath)
	}

	requestingManager := utils.ManagerProperties{
		Kind:     utils.ManagerKindRepo,
		Identity: cfg.GetName(),
	}
	if err := CheckResourceOwnership(ctx, existing, oldName, requestingManager); err != nil {
		return fmt.Errorf("wrote new resource %s but failed to delete old resource %s: %w", newName, oldName, err)
	}

	if err := client.Delete(ctx, oldName, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("wrote new resource %s but failed to delete old resource %s: %w", newName, oldName, err)
	}
	return nil
}

func (r *ResourcesManager) RenameResourceFile(ctx context.Context, previousPath, previousRef, newPath, newRef string, folderOpts ...EnsurePathOption) (string, string, schema.GroupVersionKind, error) {
	oldInfo, err := r.repo.Read(ctx, previousPath, previousRef)
	if err != nil {
		return "", "", schema.GroupVersionKind{}, fmt.Errorf("failed to read previous file: %w", err)
	}
	oldParsed, err := r.parser.Parse(ctx, oldInfo)
	if err != nil {
		return "", "", schema.GroupVersionKind{}, fmt.Errorf("failed to parse previous file: %w", err)
	}

	newInfo, err := r.repo.Read(ctx, newPath, newRef)
	if err != nil {
		return "", "", schema.GroupVersionKind{}, fmt.Errorf("failed to read new file: %w", err)
	}
	newParsed, err := r.parser.Parse(ctx, newInfo)
	if err != nil {
		return "", "", schema.GroupVersionKind{}, fmt.Errorf("failed to parse new file: %w", err)
	}

	// Delete the old resource when the identity changed (name or resource kind).
	// When both match, writeResourceFromParsed will update in place.
	if !oldParsed.SameIdentity(newParsed) {
		oldParsed.Action = provisioning.ResourceActionDelete
		if err := oldParsed.Run(ctx); err != nil {
			return oldParsed.Obj.GetName(), oldParsed.ExistingFolder(), oldParsed.GVK, fmt.Errorf("failed to delete old resource: %w", err)
		}
	} else {
		// Delete dry-run fetches the existing object (with ownership validation)
		// without mutating it, populating oldParsed.Existing for identity comparison.
		oldParsed.Action = provisioning.ResourceActionDelete
		if err := oldParsed.DryRun(ctx); err != nil {
			return "", "", schema.GroupVersionKind{}, err
		}
		// Pure path-only rename (git blob hash unchanged): the file content is
		// byte-identical, so the UPDATE we are about to send carries the same
		// spec the cluster already accepted. Skip strict schema validation so
		// a path/folder change is not blocked by stricter rules introduced
		// after the resource was first persisted (e.g. legacy dashboards
		// saved before the CUE validator was enforced).
		// Rename-with-edits (different hashes) keeps strict validation: the
		// new content is a real change and any validation failure must be
		// surfaced rather than silently admitted.
		if oldInfo.Hash != "" && oldInfo.Hash == newInfo.Hash {
			newParsed.SkipStrictValidation = true
		}
	}

	oldFolderName := oldParsed.ExistingFolder()

	newName, gvk, err := r.writeResourceFromParsed(ctx, newPath, newRef, newParsed, folderOpts...)
	if err != nil {
		return oldParsed.Obj.GetName(), oldFolderName, gvk, fmt.Errorf("failed to write resource: %w", err)
	}

	// When the resource's parent folder didn't change (e.g. the entire
	// directory was renamed and the folder was updated in place with the
	// same UID), the old folder was not emptied — suppress the signal so
	// the caller doesn't mark it for orphan deletion.
	if newParsed.Meta.GetFolder() == oldFolderName {
		oldFolderName = ""
	}

	return newName, oldFolderName, gvk, nil
}

func (r *ResourcesManager) RemoveResourceFromFile(ctx context.Context, path string, ref string) (string, string, schema.GroupVersionKind, error) {
	info, err := r.repo.Read(ctx, path, ref)
	if err != nil {
		return "", "", schema.GroupVersionKind{}, fmt.Errorf("failed to read file: %w", err)
	}

	parsed, err := r.parser.Parse(ctx, info)
	if err != nil {
		return "", "", schema.GroupVersionKind{}, err
	}

	parsed.Action = provisioning.ResourceActionDelete

	err = parsed.Run(ctx)

	objName := parsed.Obj.GetName()
	folderName := parsed.ExistingFolder()

	if err != nil {
		return objName, folderName, parsed.GVK, fmt.Errorf("failed to delete: %w", err)
	}

	return objName, folderName, parsed.GVK, nil
}
