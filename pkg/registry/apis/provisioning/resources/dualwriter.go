package resources

import (
	"context"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// DualReadWriter is a wrapper around a repository that can read from and write resources
// into both the Git repository as well as in Grafana. It isn't a dual writer in the sense of what unistore handling calls dual writing.
type DualReadWriter struct {
	repo       repository.ReaderWriter
	parser     Parser
	folders    *FolderManager
	authorizer Authorizer
}

type DualWriteOptions struct {
	Path string
	// Ref is the target branch
	// Local repositories do not use this, all other repository types do.
	// Empty ref means to target the configured default branch
	Ref          string
	Message      string
	Data         []byte
	SkipDryRun   bool
	OriginalPath string // Used for move operations
	Branch       string // Configured default branch
}

func NewDualReadWriter(repo repository.ReaderWriter, parser Parser, folders *FolderManager, authorizer Authorizer) *DualReadWriter {
	return &DualReadWriter{repo: repo, parser: parser, folders: folders, authorizer: authorizer}
}

func (r *DualReadWriter) Read(ctx context.Context, path string, ref string) (*ParsedResource, error) {
	// TODO: implement this
	if safepath.IsDir(path) {
		return nil, fmt.Errorf("folder read not supported")
	}

	info, err := r.repo.Read(ctx, path, ref)
	if err != nil {
		_, ok := utils.ExtractApiErrorStatus(err)
		if ok {
			return nil, err
		}
		return nil, fmt.Errorf("Read file failed: %w", err)
	}

	parsed, err := r.parser.Parse(ctx, info)
	if err != nil {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("Parse file failed: %v", err))
	}

	// Fail as we use the dry run for this response and it's not about updating the resource
	if err := parsed.DryRun(ctx); err != nil {
		return nil, fmt.Errorf("error running dryRun: %w", err)
	}

	if err = r.authorizer.AuthorizeResource(ctx, parsed, utils.VerbGet); err != nil {
		return nil, err
	}

	return parsed, nil
}

func (r *DualReadWriter) Delete(ctx context.Context, opts DualWriteOptions) (*ParsedResource, error) {
	if err := r.authorizer.AuthorizeWrite(ctx, opts.Ref); err != nil {
		return nil, err
	}

	if safepath.IsDir(opts.Path) {
		return r.deleteFolder(ctx, opts)
	}

	// Read the file from the default branch as it won't exist in the possibly new branch
	file, err := r.repo.Read(ctx, opts.Path, "")
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	// HACK: manual set to the provided branch so that the parser can possible read the file
	if !r.shouldUpdateGrafanaDB(opts, nil) {
		file.Ref = opts.Ref
	}

	// TODO: document in API specification
	// We can only delete parsable things
	parsed, err := r.parser.Parse(ctx, file)
	if err != nil {
		return nil, fmt.Errorf("parse file: %w", err)
	}

	if err = r.authorizer.AuthorizeResource(ctx, parsed, utils.VerbDelete); err != nil {
		return nil, err
	}

	parsed.Action = provisioning.ResourceActionDelete

	// Use the parser's DryRun method like create/update operations
	if !opts.SkipDryRun {
		if err := parsed.DryRun(ctx); err != nil {
			return nil, fmt.Errorf("error running dryRun for delete: %w", err)
		}
	}

	err = r.repo.Delete(ctx, opts.Path, opts.Ref, opts.Message)
	if err != nil {
		return nil, fmt.Errorf("delete file from repository: %w", err)
	}

	// Delete the file in the grafana database using the parser's Run method
	if r.shouldUpdateGrafanaDB(opts, nil) {
		err = parsed.Run(ctx)
		if err != nil {
			return nil, fmt.Errorf("delete resource from storage: %w", err)
		}
	}

	return parsed, err
}

// CreateFolder creates a new folder in the repository
// FIXME: fix signature to return ParsedResource
func (r *DualReadWriter) CreateFolder(ctx context.Context, opts DualWriteOptions) (*provisioning.ResourceWrapper, error) {
	if err := r.authorizer.AuthorizeWrite(ctx, opts.Ref); err != nil {
		return nil, err
	}

	if !safepath.IsDir(opts.Path) {
		return nil, fmt.Errorf("not a folder path")
	}

	// For create operations, use empty name to check parent folder permissions
	folderParsed := folderParsedResource(opts.Path, opts.Ref, r.repo.Config(), "")
	if err := r.authorizer.AuthorizeResource(ctx, folderParsed, utils.VerbCreate); err != nil {
		return nil, err
	}
	// TODO: authorized to create folders under first existing ancestor folder

	// Now actually create the folder
	if err := r.repo.Create(ctx, opts.Path, opts.Ref, nil, opts.Message); err != nil {
		return nil, fmt.Errorf("failed to create folder: %w", err)
	}

	cfg := r.repo.Config()
	wrap := &provisioning.ResourceWrapper{
		Path: opts.Path,
		Ref:  opts.Ref,
		Repository: provisioning.ResourceRepositoryInfo{
			Type:      cfg.Spec.Type,
			Namespace: cfg.Namespace,
			Name:      cfg.Name,
			Title:     cfg.Spec.Title,
		},
		Resource: provisioning.ResourceObjects{
			Action: provisioning.ResourceActionCreate,
		},
	}

	urls, err := getFolderURLs(ctx, opts.Path, opts.Ref, r.repo)
	if err != nil {
		return nil, err
	}
	wrap.URLs = urls

	if r.shouldUpdateGrafanaDB(opts, nil) {
		folderName, err := r.folders.EnsureFolderPathExist(ctx, opts.Path)
		if err != nil {
			return nil, err
		}

		current, err := r.folders.GetFolder(ctx, folderName)
		if err != nil && !apierrors.IsNotFound(err) {
			return nil, err // unable to check if the folder exists
		}
		wrap.Resource.Upsert = v0alpha1.Unstructured{
			Object: current.Object,
		}
	}

	return wrap, nil
}

// CreateResource creates a new resource in the repository
func (r *DualReadWriter) CreateResource(ctx context.Context, opts DualWriteOptions) (*ParsedResource, error) {
	if err := r.authorizer.AuthorizeWrite(ctx, opts.Ref); err != nil {
		return nil, err
	}

	info := &repository.FileInfo{
		Data: opts.Data,
		Path: opts.Path,
		Ref:  opts.Ref,
	}

	parsed, err := r.parser.Parse(ctx, info)
	if err != nil {
		return nil, err
	}

	// TODO: check if the resource does not exist in the database.

	// Make sure the value is valid
	if !opts.SkipDryRun {
		if err := parsed.DryRun(ctx); err != nil {
			logger := logging.FromContext(ctx).With("path", opts.Path, "name", parsed.Obj.GetName(), "ref", opts.Ref)
			logger.Warn("failed to dry run resource on create", "error", err)

			return nil, fmt.Errorf("error running dryRun: %w", err)
		}
	}

	if len(parsed.Errors) > 0 {
		// Now returns BadRequest (400) for validation errors
		return nil, fmt.Errorf("errors while parsing file [%v]", parsed.Errors)
	}

	// TODO: is this the right way?
	// Check if resource already exists - create should fail if it does
	if err = r.ensureExisting(ctx, parsed); err != nil {
		return nil, err
	}
	if parsed.Existing != nil {
		return nil, apierrors.NewConflict(parsed.GVR.GroupResource(), parsed.Obj.GetName(),
			fmt.Errorf("resource already exists"))
	}

	// Authorization check: Check if we can create the resource in the folder from the file
	if err = r.authorizer.AuthorizeResource(ctx, parsed, utils.VerbCreate); err != nil {
		return nil, err
	}

	// TODO: authorized to create folders under first existing ancestor folder

	data, err := parsed.ToSaveBytes()
	if err != nil {
		return nil, err
	}

	// Always use the provisioning identity when writing
	ctx, _, err = identity.WithProvisioningIdentity(ctx, parsed.Obj.GetNamespace())
	if err != nil {
		return nil, fmt.Errorf("unable to use provisioning identity %w", err)
	}

	// TODO: handle the error repository.ErrFileAlreadyExists
	err = r.repo.Create(ctx, opts.Path, opts.Ref, data, opts.Message)
	if err != nil {
		return nil, err // raw error is useful
	}

	// Directly update the grafana database
	// Behaves the same running sync after writing
	// FIXME: to make sure if behaves in the same way as in sync, we should
	// we should refactor the code to use the same function.
	if r.shouldUpdateGrafanaDB(opts, parsed) {
		if _, err := r.folders.EnsureFolderPathExist(ctx, opts.Path); err != nil {
			return nil, fmt.Errorf("ensure folder path exists: %w", err)
		}

		err = parsed.Run(ctx)
	}

	return parsed, err
}

// UpdateResource updates a resource in the repository
func (r *DualReadWriter) UpdateResource(ctx context.Context, opts DualWriteOptions) (*ParsedResource, error) {
	if err := r.authorizer.AuthorizeWrite(ctx, opts.Ref); err != nil {
		return nil, err
	}

	info := &repository.FileInfo{
		Data: opts.Data,
		Path: opts.Path,
		Ref:  opts.Ref,
	}

	parsed, err := r.parser.Parse(ctx, info)
	if err != nil {
		return nil, err
	}

	// Make sure the value is valid
	if !opts.SkipDryRun {
		if err := parsed.DryRun(ctx); err != nil {
			logger := logging.FromContext(ctx).With("path", opts.Path, "name", parsed.Obj.GetName(), "ref", opts.Ref)
			logger.Warn("failed to dry run resource on update", "error", err)

			return nil, fmt.Errorf("error running dryRun: %w", err)
		}
	}

	if len(parsed.Errors) > 0 {
		// Now returns BadRequest (400) for validation errors
		return nil, fmt.Errorf("errors while parsing file [%v]", parsed.Errors)
	}

	// Populate existing resource to check permissions in the correct folder
	if err = r.ensureExisting(ctx, parsed); err != nil {
		return nil, err
	}

	// TODO: what to do with a name or kind change?

	// Authorization check: Check if we can update the existing resource in its current folder
	if err = r.authorizer.AuthorizeResource(ctx, parsed, utils.VerbUpdate); err != nil {
		return nil, err
	}

	data, err := parsed.ToSaveBytes()
	if err != nil {
		return nil, err
	}

	// Always use the provisioning identity when writing
	ctx, _, err = identity.WithProvisioningIdentity(ctx, parsed.Obj.GetNamespace())
	if err != nil {
		return nil, fmt.Errorf("unable to use provisioning identity %w", err)
	}

	err = r.repo.Update(ctx, opts.Path, opts.Ref, data, opts.Message)
	if err != nil {
		return nil, err // raw error is useful
	}

	// Directly update the grafana database
	// Behaves the same running sync after writing
	// FIXME: to make sure if behaves in the same way as in sync, we should
	// we should refactor the code to use the same function.
	if r.shouldUpdateGrafanaDB(opts, parsed) {
		if _, err := r.folders.EnsureFolderPathExist(ctx, opts.Path); err != nil {
			return nil, fmt.Errorf("ensure folder path exists: %w", err)
		}

		err = parsed.Run(ctx)
	}

	return parsed, err
}

// MoveResource moves a resource from one path to another in the repository
func (r *DualReadWriter) MoveResource(ctx context.Context, opts DualWriteOptions) (*ParsedResource, error) {
	if err := r.authorizer.AuthorizeWrite(ctx, opts.Ref); err != nil {
		return nil, err
	}

	if opts.OriginalPath == "" {
		return nil, fmt.Errorf("originalPath is required for move operations")
	}

	// Validate that both paths are either files or directories (consistent types)
	// Files should end without '/', directories should end with '/'
	sourceIsDir := safepath.IsDir(opts.OriginalPath)
	targetIsDir := safepath.IsDir(opts.Path)
	if sourceIsDir != targetIsDir {
		return nil, fmt.Errorf("cannot move between file and directory types - source is %s, target is %s",
			getPathType(sourceIsDir), getPathType(targetIsDir))
	}

	// Handle directory moves separately (no parsing/authorization needed)
	if sourceIsDir {
		return r.moveDirectory(ctx, opts)
	}

	// Handle file moves with parsing and authorization
	return r.moveFile(ctx, opts)
}

func (r *DualReadWriter) moveDirectory(ctx context.Context, opts DualWriteOptions) (*ParsedResource, error) {
	// Reject directory move operations for configured branch - use bulk operations instead
	if r.isConfiguredBranch(opts) {
		return nil, &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusMethodNotAllowed,
				Reason:  metav1.StatusReasonMethodNotAllowed,
				Message: "directory move operations are not available for configured branch. Use bulk move operations via the jobs API instead",
			},
		}
	}

	// Check permissions to delete the original folder
	originalFolderID := ParseFolder(opts.OriginalPath, r.repo.Config().Name).ID
	originalFolderParsed := folderParsedResource(opts.OriginalPath, opts.Ref, r.repo.Config(), originalFolderID)
	if err := r.authorizer.AuthorizeResource(ctx, originalFolderParsed, utils.VerbDelete); err != nil {
		return nil, fmt.Errorf("not authorized to move from original folder: %w", err)
	}

	// Check permissions to create at the new folder location (empty name for create)
	newFolderParsed := folderParsedResource(opts.Path, opts.Ref, r.repo.Config(), "")
	if err := r.authorizer.AuthorizeResource(ctx, newFolderParsed, utils.VerbCreate); err != nil {
		return nil, fmt.Errorf("not authorized to move to new folder: %w", err)
	}

	// For branch operations, we just perform the repository move without updating Grafana DB
	// Always use the provisioning identity when writing
	ctx, _, err := identity.WithProvisioningIdentity(ctx, r.repo.Config().Namespace)
	if err != nil {
		return nil, fmt.Errorf("unable to use provisioning identity: %w", err)
	}

	// Perform the move operation in the repository
	if err = r.repo.Move(ctx, opts.OriginalPath, opts.Path, opts.Ref, opts.Message); err != nil {
		return nil, fmt.Errorf("move directory in repository: %w", err)
	}

	// Create a basic parsed resource response for directories
	cfg := r.repo.Config()
	parsed := &ParsedResource{
		Action: provisioning.ResourceActionMove,
		Info: &repository.FileInfo{
			Path: opts.Path,
			Ref:  opts.Ref,
		},
		GVK: schema.GroupVersionKind{
			Group:   FolderResource.Group,
			Version: FolderResource.Version,
			Kind:    "Folder",
		},
		GVR: FolderResource,
		Repo: provisioning.ResourceRepositoryInfo{
			Type:      cfg.Spec.Type,
			Namespace: cfg.Namespace,
			Name:      cfg.Name,
			Title:     cfg.Spec.Title,
		},
	}

	return parsed, nil
}

func (r *DualReadWriter) moveFile(ctx context.Context, opts DualWriteOptions) (*ParsedResource, error) {
	// Read the original file to get its content for parsing and authorization
	originalFile, err := r.repo.Read(ctx, opts.OriginalPath, "")
	if err != nil {
		return nil, fmt.Errorf("read original file: %w", err)
	}

	// Parse the original file to check permissions
	parsed, err := r.parser.Parse(ctx, originalFile)
	if err != nil {
		return nil, fmt.Errorf("parse original file: %w", err)
	}

	// Populate existing resource to check delete permission in the correct folder
	if err = r.ensureExisting(ctx, parsed); err != nil {
		return nil, err
	}

	// Authorize delete on the original path (checks existing resource's folder if it exists)
	if err = r.authorizer.AuthorizeResource(ctx, parsed, utils.VerbDelete); err != nil {
		return nil, fmt.Errorf("not authorized to delete original file: %w", err)
	}

	// Determine the content to use for the destination
	// If new content is provided in opts.Data, use it; otherwise use original content
	var destinationData []byte
	if len(opts.Data) > 0 {
		destinationData = opts.Data
	} else {
		destinationData = originalFile.Data
	}

	// Create new parsed resource with updated path and content
	newInfo := &repository.FileInfo{
		Data: destinationData,
		Path: opts.Path,
		Ref:  opts.Ref,
	}

	newParsed, err := r.parser.Parse(ctx, newInfo)
	if err != nil {
		return nil, fmt.Errorf("parse new file: %w", err)
	}

	// Make sure the new resource is valid
	if !opts.SkipDryRun {
		if err := newParsed.DryRun(ctx); err != nil {
			logger := logging.FromContext(ctx).With("path", opts.Path, "originalPath", opts.OriginalPath, "name", newParsed.Obj.GetName(), "ref", opts.Ref)
			logger.Warn("failed to dry run resource on move", "error", err)
			return nil, fmt.Errorf("error running dryRun on moved resource: %w", err)
		}
	}

	if len(newParsed.Errors) > 0 {
		return nil, fmt.Errorf("errors while parsing moved file [%v]", newParsed.Errors)
	}

	// Populate existing resource at destination to check if we're overwriting something
	if err = r.ensureExisting(ctx, newParsed); err != nil {
		return nil, err
	}

	// Authorize for the target resource
	// - If resource exists at destination: Check if we can update it in its folder
	// - If no resource at destination: Check if we can create in the new folder
	verb := utils.VerbUpdate
	if newParsed.Existing == nil {
		verb = utils.VerbCreate
	}
	if err = r.authorizer.AuthorizeResource(ctx, newParsed, verb); err != nil {
		return nil, fmt.Errorf("not authorized for destination: %w", err)
	}

	data, err := newParsed.ToSaveBytes()
	if err != nil {
		return nil, err
	}

	// Always use the provisioning identity when writing
	ctx, _, err = identity.WithProvisioningIdentity(ctx, newParsed.Obj.GetNamespace())
	if err != nil {
		return nil, fmt.Errorf("unable to use provisioning identity: %w", err)
	}

	// Perform the move operation in the repository
	// If we have new content, we need to update the file content as part of the move
	if len(opts.Data) > 0 {
		// FIXME: I think we should MOVE + UPDATE instead of Delete / Create
		// For moves with content updates, we need to delete the old file and create the new one
		if err = r.repo.Delete(ctx, opts.OriginalPath, opts.Ref, opts.Message); err != nil {
			return nil, fmt.Errorf("delete original file in repository: %w", err)
		}
		if err = r.repo.Create(ctx, opts.Path, opts.Ref, data, opts.Message); err != nil {
			return nil, fmt.Errorf("create moved file with new content in repository: %w", err)
		}
	} else {
		// For simple moves without content changes, use the move operation
		if err = r.repo.Move(ctx, opts.OriginalPath, opts.Path, opts.Ref, opts.Message); err != nil {
			return nil, fmt.Errorf("move file in repository: %w", err)
		}
	}

	// Update the grafana database if this is the main branch
	if r.shouldUpdateGrafanaDB(opts, newParsed) {
		if _, err := r.folders.EnsureFolderPathExist(ctx, opts.Path); err != nil {
			return nil, fmt.Errorf("ensure folder path exists: %w", err)
		}

		// Delete the old resource from grafana if name changed
		if newParsed.Obj.GetName() != parsed.Obj.GetName() {
			err = parsed.Client.Delete(ctx, parsed.Obj.GetName(), metav1.DeleteOptions{})
			if err != nil && !apierrors.IsNotFound(err) {
				return nil, fmt.Errorf("delete original resource from storage: %w", err)
			}
		}

		// Create/update the new resource in grafana
		err = newParsed.Run(ctx)
		if err != nil {
			return nil, fmt.Errorf("create moved resource in storage: %w", err)
		}
	}

	newParsed.Action = provisioning.ResourceActionMove

	return newParsed, nil
}

// ensureExisting populates parsed.Existing if a resource with the given name exists in storage.
// Returns nil if no resource exists, if Client is nil, or if Existing is already populated.
// This is used before authorization checks to ensure we validate permissions against the actual
// existing resource's folder, not just the folder specified in the file.
func (r *DualReadWriter) ensureExisting(ctx context.Context, parsed *ParsedResource) error {
	if parsed.Client == nil || parsed.Existing != nil {
		return nil // Already populated or can't check
	}

	existing, err := parsed.Client.Get(ctx, parsed.Obj.GetName(), metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil // No existing resource
		}
		return fmt.Errorf("failed to check for existing resource: %w", err)
	}

	parsed.Existing = existing
	return nil
}

func (r *DualReadWriter) deleteFolder(ctx context.Context, opts DualWriteOptions) (*ParsedResource, error) {
	// Reject directory delete operations for configured branch - use bulk operations instead
	if r.isConfiguredBranch(opts) {
		return nil, &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusMethodNotAllowed,
				Reason:  metav1.StatusReasonMethodNotAllowed,
				Message: "directory delete operations are not available for configured branch. Use bulk delete operations via the jobs API instead",
			},
		}
	}

	// Check permissions to delete the folder
	folderID := ParseFolder(opts.Path, r.repo.Config().Name).ID
	folderParsed := folderParsedResource(opts.Path, opts.Ref, r.repo.Config(), folderID)
	if err := r.authorizer.AuthorizeResource(ctx, folderParsed, utils.VerbDelete); err != nil {
		return nil, err
	}

	// For branch operations, just delete from the repository without updating Grafana DB
	err := r.repo.Delete(ctx, opts.Path, opts.Ref, opts.Message)
	if err != nil {
		return nil, fmt.Errorf("error deleting folder from repository: %w", err)
	}

	return folderDeleteResponse(ctx, opts.Path, opts.Ref, r.repo)
}

func getFolderURLs(ctx context.Context, path, ref string, repo repository.Repository) (*provisioning.RepositoryURLs, error) {
	if urlRepo, ok := repo.(repository.RepositoryWithURLs); ok && ref != "" {
		urls, err := urlRepo.ResourceURLs(ctx, &repository.FileInfo{Path: path, Ref: ref})
		if err != nil {
			return nil, err
		}
		return urls, nil
	}
	return nil, nil
}

// getPathType returns a human-readable description of the path type
func getPathType(isDir bool) string {
	if isDir {
		return "directory (ends with '/')"
	}
	return "file (no trailing '/')"
}

// folderParsedResource creates a ParsedResource for a folder path.
// This is used for authorization checks on folder operations.
// For create operations, name should be empty string to check parent permissions.
// For other operations, name should be the folder ID derived from the path.
func folderParsedResource(path, ref string, repo *provisioning.Repository, name string) *ParsedResource {
	folderObj := &unstructured.Unstructured{}
	folderObj.SetName(name)
	folderObj.SetNamespace(repo.Namespace)

	// TODO: which parent? top existing ancestor.

	meta, _ := utils.MetaAccessor(folderObj)
	if meta != nil {
		// Set parent folder for folder operations
		parentFolder := ""
		if path != "" {
			parentPath := safepath.Dir(path)
			if parentPath != "" {
				parentFolder = ParseFolder(parentPath, repo.Name).ID
			} else {
				parentFolder = RootFolder(repo)
			}
		}
		meta.SetFolder(parentFolder)
	}

	return &ParsedResource{
		Info: &repository.FileInfo{
			Path: path,
			Ref:  ref,
		},
		Obj:  folderObj,
		Meta: meta,
		GVK: schema.GroupVersionKind{
			Group:   FolderResource.Group,
			Version: FolderResource.Version,
			Kind:    "Folder",
		},
		GVR: FolderResource,
		Repo: provisioning.ResourceRepositoryInfo{
			Type:      repo.Spec.Type,
			Namespace: repo.Namespace,
			Name:      repo.Name,
			Title:     repo.Spec.Title,
		},
	}
}

func folderDeleteResponse(ctx context.Context, path, ref string, repo repository.Repository) (*ParsedResource, error) {
	urls, err := getFolderURLs(ctx, path, ref, repo)
	if err != nil {
		return nil, err
	}

	parsed := &ParsedResource{
		Action: provisioning.ResourceActionDelete,
		Info: &repository.FileInfo{
			Path: path,
			Ref:  ref,
		},
		GVK: schema.GroupVersionKind{
			Group:   FolderResource.Group,
			Version: FolderResource.Version,
			Kind:    "Folder",
		},
		GVR: FolderResource,
		Repo: provisioning.ResourceRepositoryInfo{
			Type:      repo.Config().Spec.Type,
			Namespace: repo.Config().Namespace,
			Name:      repo.Config().Name,
			Title:     repo.Config().Spec.Title,
		},
		URLs: urls,
	}

	return parsed, nil
}

// isConfiguredBranch returns true if the ref targets the configured branch
// (empty ref means configured branch, or ref explicitly matches configured branch)
func (r *DualReadWriter) isConfiguredBranch(opts DualWriteOptions) bool {
	configuredBranch := r.repo.Config().Branch()
	return opts.Ref == "" || opts.Ref == configuredBranch
}

// shouldUpdateGrafanaDB returns true if we have an empty ref (targeting the configured branch)
// or if the ref matches the configured branch
func (r *DualReadWriter) shouldUpdateGrafanaDB(opts DualWriteOptions, parsed *ParsedResource) bool {
	if parsed != nil && parsed.Client == nil {
		return false
	}

	return r.isConfiguredBranch(opts)
}
