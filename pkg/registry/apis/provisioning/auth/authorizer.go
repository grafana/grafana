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
//
// Permission Model:
//   - Permissions on a parent folder grant at least that level of access to all children
//   - Children can have elevated permissions, but never reduced permissions
//   - Resource operations verify permissions based on the resource's actual location
//   - Folder operations verify permissions on the folder itself, not recursively on contents
//   - File metadata is user-controlled and not solely trusted for permission checks
type Authorizer interface {
	// AuthorizeResource checks if the current user has permission to perform
	// the specified verb on the given resource.
	//
	// For existing resources, permissions are checked against the folder where the
	// resource currently exists (from the database), not the folder specified in the
	// file metadata. This ensures users cannot bypass folder permissions by declaring
	// a different folder in their file content.
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
// Authorization Model:
//   - For new resources: Uses the folder from the file metadata
//   - For existing resources: Uses the folder where the resource currently exists
//
// This distinction is important because the file content is user-controlled, while the
// existing resource location comes from the database. Checking against the actual location
// prevents users from bypassing folder permissions by declaring a different folder in their file.
func (a *ProvisioningAuthorizer) AuthorizeResource(ctx context.Context, parsed *ParsedResource, verb string) error {
	// Determine the resource name for the authorization check
	var name string
	if parsed.Existing != nil {
		name = parsed.Existing.GetName()
	} else {
		name = parsed.Obj.GetName()
	}

	// Determine the folder for the authorization check.
	// For new resources, use the folder from the file metadata.
	// For existing resources, use the folder where the resource actually exists.
	folder := parsed.Meta.GetFolder()
	if parsed.Existing != nil {
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
// specified path.
//
// Authorization is checked against the parent folder: to create a new folder, the user
// must have create permissions on the parent folder where it will be placed.
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

	// Check create permission on the parent folder
	return a.access.Check(ctx, authlib.CheckRequest{
		Group:    FolderResource.Group,
		Resource: FolderResource.Resource,
		Name:     "", // Empty name indicates permission check on parent
		Verb:     utils.VerbCreate,
	}, parentFolder)
}

// AuthorizeDeleteFolder checks if the user has permission to delete the folder at the
// specified path.
//
// Authorization is checked only against the folder itself. Permissions on the parent folder
// grant at least that level of access to all children, so checking the folder is sufficient.
// Individual nested resources are not checked separately.
func (a *ProvisioningAuthorizer) AuthorizeDeleteFolder(ctx context.Context, path string) error {
	folderID := parseFolder(path, a.repo.Name)

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
// Moving a folder requires two permissions:
//   1. Update permission on the source folder (the folder being moved)
//   2. Create permission on the target parent folder (where it's being moved to)
//
// Individual nested resources are not checked separately. Permissions on the source folder
// apply to all its contents, so checking the folder itself is sufficient.
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
		Name:     "", // Empty name indicates permission check on parent
		Verb:     utils.VerbCreate,
	}, parentFolder)
}

// AuthorizeWrite checks if writes are allowed to the specified ref.
// This delegates to the repository's write authorization logic.
func (a *ProvisioningAuthorizer) AuthorizeWrite(ctx context.Context, ref string) error {
	return repository.IsWriteAllowed(a.repo, ref)
}
