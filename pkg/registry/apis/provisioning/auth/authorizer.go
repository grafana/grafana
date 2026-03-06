package auth

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Authorizer handles authorization checks for provisioning file and folder operations.
// It provides a clean abstraction for checking permissions on resources, files, and folders.
type Authorizer interface {
	// AuthorizeResource checks if the current user has permission to perform
	// the specified verb on the given resource.
	//
	// SECURITY: For existing resources, this checks permissions on the folder where
	// the resource actually exists, not the folder claimed in the file content.
	// This prevents privilege escalation via folder claim manipulation.
	AuthorizeResource(ctx context.Context, parsed *ParsedResource, verb string) error

	// AuthorizeCreateFolder checks if the current user has permission to create
	// a folder at the specified path. This checks create permission on the parent folder.
	AuthorizeCreateFolder(ctx context.Context, path string) error

	// AuthorizeDeleteFolder checks if the current user has permission to delete
	// the folder at the specified path. This checks delete permission on the folder itself.
	AuthorizeDeleteFolder(ctx context.Context, path string) error

	// AuthorizeMoveFolder checks if the current user has permission to move a folder
	// from originalPath to targetPath. This checks:
	// - Update permission on the source folder
	// - Create permission on the target parent folder
	AuthorizeMoveFolder(ctx context.Context, originalPath, targetPath string) error

	// AuthorizeWrite checks if writes are allowed to the specified ref.
	// This ensures operations on the configured branch are properly authorized.
	AuthorizeWrite(ctx context.Context, ref string) error
}

// ProvisioningAuthorizer implements Authorizer for provisioning operations.
type ProvisioningAuthorizer struct {
	repo   *provisioning.Repository
	access auth.AccessChecker
}

// NewAuthorizer creates a new ProvisioningAuthorizer.
func NewAuthorizer(repo *provisioning.Repository, access auth.AccessChecker) Authorizer {
	return &ProvisioningAuthorizer{
		repo:   repo,
		access: access,
	}
}

// AuthorizeResource checks if the current user has permission to perform the specified
// verb on the given resource.
//
// CRITICAL SECURITY FIX: For existing resources, this checks permissions in the folder
// where the resource actually exists, not the folder specified in the file content.
// This prevents a security vulnerability where a malicious file could specify a different
// folder to bypass permission checks.
//
// Permission Model:
//   - For new resources: Uses the folder from the file metadata
//   - For existing resources: Uses the folder from the actual resource (SECURITY FIX)
func (a *ProvisioningAuthorizer) AuthorizeResource(ctx context.Context, parsed *ParsedResource, verb string) error {
	// Determine the resource name for the authorization check
	var name string
	if parsed.Existing != nil {
		name = parsed.Existing.GetName()
	} else {
		name = parsed.Obj.GetName()
	}

	// Determine the folder for the authorization check
	// CRITICAL FIX: For existing resources, check permissions in the folder where
	// the resource actually exists, not the folder specified in the file.
	folder := parsed.Meta.GetFolder()
	if parsed.Existing != nil {
		// Use the folder from the existing resource
		if meta, err := utils.MetaAccessor(parsed.Existing); err == nil && meta != nil {
			folder = meta.GetFolder()
		}
	}

	// Perform the authorization check
	return a.access.Check(ctx, authlib.CheckRequest{
		Group:    parsed.GVR.Group,
		Resource: parsed.GVR.Resource,
		Name:     name,
		Verb:     verb,
	}, folder)
}

// AuthorizeCreateFolder checks if the user has permission to create a folder at the
// specified path. This checks create permission on the parent folder.
func (a *ProvisioningAuthorizer) AuthorizeCreateFolder(ctx context.Context, path string) error {
	// Determine parent folder from path
	parentFolder := ""
	if path != "" {
		parentPath := dirPath(path)
		if parentPath != "" {
			parentFolder = parseFolder(parentPath, a.repo.Name)
		} else {
			parentFolder = rootFolder(a.repo)
		}
	}

	// For folder create operations, use empty name to check parent folder permissions
	return a.access.Check(ctx, authlib.CheckRequest{
		Group:    FolderResource.Group,
		Resource: FolderResource.Resource,
		Name:     "", // Empty name for create operations
		Verb:     utils.VerbCreate,
	}, parentFolder)
}

// AuthorizeDeleteFolder checks if the user has permission to delete the folder at the
// specified path. This checks delete permission on the folder itself.
//
// Permission Model:
// For folder operations (by path), we only check the top-level folder being deleted,
// not recursively checking every nested resource. This follows the permission model where
// folder-level operations check the folder itself, and individual resource operations
// check each resource.
func (a *ProvisioningAuthorizer) AuthorizeDeleteFolder(ctx context.Context, path string) error {
	// Determine the folder ID being deleted
	folderID := parseFolder(path, a.repo.Name)

	// Check delete permission on the folder itself
	return a.access.Check(ctx, authlib.CheckRequest{
		Group:    FolderResource.Group,
		Resource: FolderResource.Resource,
		Name:     folderID,
		Verb:     utils.VerbDelete,
	}, folderID)
}

// AuthorizeMoveFolder checks if the user has permission to move a folder from
// originalPath to targetPath.
//
// Permission Model:
// For folder operations (by path), we only check the top-level folder being moved,
// not recursively checking every nested resource. This follows the permission model where
// folder-level operations check the folder itself, and individual resource operations
// check each resource.
//
// Requirements:
//   - Update permission on the source folder
//   - Create permission on the target parent folder
func (a *ProvisioningAuthorizer) AuthorizeMoveFolder(ctx context.Context, originalPath, targetPath string) error {
	// Check update permission on the source folder
	sourceFolderID := parseFolder(originalPath, a.repo.Name)
	if err := a.access.Check(ctx, authlib.CheckRequest{
		Group:    FolderResource.Group,
		Resource: FolderResource.Resource,
		Name:     sourceFolderID,
		Verb:     utils.VerbUpdate,
	}, sourceFolderID); err != nil {
		return err
	}

	// Check create permission on the target parent folder
	parentFolder := ""
	if targetPath != "" {
		parentPath := dirPath(targetPath)
		if parentPath != "" {
			parentFolder = parseFolder(parentPath, a.repo.Name)
		} else {
			parentFolder = rootFolder(a.repo)
		}
	}

	return a.access.Check(ctx, authlib.CheckRequest{
		Group:    FolderResource.Group,
		Resource: FolderResource.Resource,
		Name:     "", // Empty name for create operations in parent
		Verb:     utils.VerbCreate,
	}, parentFolder)
}

// AuthorizeWrite checks if writes are allowed to the specified ref.
// This delegates to the repository's write authorization logic.
func (a *ProvisioningAuthorizer) AuthorizeWrite(ctx context.Context, ref string) error {
	return repository.IsWriteAllowed(a.repo, ref)
}
