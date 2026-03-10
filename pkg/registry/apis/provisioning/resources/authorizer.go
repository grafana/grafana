package resources

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
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
//
// Example Hierarchy:
//
//	Team Folder (user is Editor)
//	├── Dashboard A (inherits at least Editor from parent)
//	├── Dashboard B (can have elevated permissions, e.g., Admin)
//	└── Subfolder (inherits at least Editor from parent)
//	    └── Dashboard C (inherits at least Editor from Team Folder)
//
// If user is Editor on "Team Folder", they automatically have at least Editor on all contents.
type Authorizer interface {
	// AuthorizeResource checks if the current user has permission to perform
	// the specified verb on the given resource.
	//
	// For existing resources, permissions are checked against the folder where the
	// resource currently exists (from the database), not the folder specified in the
	// file metadata. This ensures users cannot bypass folder permissions by declaring
	// a different folder in their file content.
	//
	// Example:
	//   - Dashboard "my-dash" exists in "team-a-folder" (user is Reader - no edit access)
	//   - User submits file claiming dashboard is in "public-folder" (user is Editor)
	//   - Authorization checks "team-a-folder" (actual location) → DENIED
	//   - This prevents bypassing folder permissions via file metadata manipulation
	AuthorizeResource(ctx context.Context, parsed *ParsedResource, verb string) error

	// AuthorizeCreateFolder checks if the current user has permission to create
	// a folder at the specified path. This checks create permission on the parent folder.
	//
	// Example:
	//   - User wants to create "team-a/project-x/"
	//   - Checks: create permission on "team-a" folder
	//   - If user is Editor or Admin on "team-a", the operation is allowed
	AuthorizeCreateFolder(ctx context.Context, path string) error

	// AuthorizeDeleteFolder checks if the current user has permission to delete
	// the folder at the specified path. This checks delete permission on the folder itself.
	//
	// Example:
	//   - User wants to delete "team-a/project-x/" (contains dashboards A, B, C)
	//   - Checks: delete permission on "team-a/project-x" folder
	//   - Does NOT check permissions on dashboards A, B, C individually
	//   - Folder permissions apply to all contents
	AuthorizeDeleteFolder(ctx context.Context, path string) error

	// AuthorizeMoveFolder checks if the current user has permission to move a folder
	// from originalPath to targetPath. This checks:
	// - Update permission on the source folder
	// - Create permission on the target parent folder
	//
	// Example:
	//   - User wants to move "team-a/old-project/" to "team-b/new-project/"
	//   - Checks: update permission on "team-a/old-project"
	//   - Checks: create permission on "team-b" (parent of target)
	//   - Does NOT check permissions on contents of "old-project"
	AuthorizeMoveFolder(ctx context.Context, originalPath, targetPath string) error

	// AuthorizeWrite checks if writes are allowed to the specified ref.
	// This ensures operations on the configured branch are properly authorized.
	AuthorizeWrite(ctx context.Context, ref string) error
}

// ProvisioningAuthorizer implements Authorizer for provisioning operations.
type ProvisioningAuthorizer struct {
	repo                  *provisioning.Repository
	reader                repository.Reader
	access                auth.AccessChecker
	folderMetadataEnabled bool
}

// NewAuthorizer creates a new ProvisioningAuthorizer.
func NewAuthorizer(repo *provisioning.Repository, reader repository.Reader, access auth.AccessChecker, folderMetadataEnabled bool) Authorizer {
	return &ProvisioningAuthorizer{
		repo:                  repo,
		reader:                reader,
		access:                access,
		folderMetadataEnabled: folderMetadataEnabled,
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
//
// Example - Creating a new dashboard:
//   - File declares: folder="team-a"
//   - Checks: create permission on "team-a" (user must be Editor or Admin)
//
// Example - Updating existing dashboard:
//   - File declares: folder="public" (user is Editor)
//   - Actual location: folder="team-a" (user is Reader - no edit access)
//   - Checks: update permission on "team-a" (actual location)
//   - Result: DENIED (prevents permission bypass)
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

// authorizeFolder is a private helper that checks if the user has permission to perform
// the specified verb on the folder at the given path.
//
// Authorization model:
//   - For delete: Checks permission in the parent folder context (removing from parent)
//   - For update: Checks permission using the folder's own ID as context (modifying the folder)
//   - For create: Should be checked on the parent folder instead
//
// When folder metadata is enabled, folder IDs are determined by reading _folder.json.
// Otherwise, it falls back to hash-based ID.
func (a *ProvisioningAuthorizer) authorizeFolder(ctx context.Context, path string, verb string) error {
	// Get the folder's ID
	folderID, err := GetFolderID(ctx, a.reader, path, "", a.folderMetadataEnabled)
	if err != nil {
		return fmt.Errorf("get folder ID: %w", err)
	}

	// Determine the folder context based on the verb
	var folderContext string
	switch verb {
	case utils.VerbDelete:
		// For delete, check in the parent folder context
		parentPath := safepath.Dir(path)
		if parentPath == "" {
			// Root-level folder
			folderContext = ""
		} else {
			folderContext, err = GetFolderID(ctx, a.reader, parentPath, "", a.folderMetadataEnabled)
			if err != nil {
				return fmt.Errorf("get parent folder ID: %w", err)
			}
		}
	default:
		// For update and other verbs, use the folder's own ID as context
		folderContext = folderID
	}

	return a.access.Check(ctx, authlib.CheckRequest{
		Group:    FolderResource.Group,
		Resource: FolderResource.Resource,
		Name:     folderID,
		Verb:     verb,
	}, folderContext)
}

// AuthorizeCreateFolder checks if the user has permission to create a folder at the
// specified path.
//
// Authorization is checked against the parent folder: to create a new folder, the user
// must have create permissions on the parent folder where it will be placed.
//
// When folder metadata is enabled, the parent folder ID is determined by reading
// the _folder.json file if it exists. Otherwise, it falls back to hash-based ID.
//
// Example:
//   - Creating "team-a/new-project/" requires create permission on "team-a"
//   - Creating "top-level-folder/" requires create permission on root
func (a *ProvisioningAuthorizer) AuthorizeCreateFolder(ctx context.Context, path string) error {
	// For create operations, check permission on the parent folder
	if path == "" {
		return fmt.Errorf("path cannot be empty")
	}

	parentPath := safepath.Dir(path)
	if parentPath == "" {
		// Creating at root - check root folder permission
		// TODO: Consider how to handle root folder authorization
		// For now, delegate to the old permission check on root
		return a.access.Check(ctx, authlib.CheckRequest{
			Group:    FolderResource.Group,
			Resource: FolderResource.Resource,
			Name:     "",
			Verb:     utils.VerbCreate,
		}, RootFolder(a.repo))
	}

	// Check create permission on the parent folder
	return a.authorizeFolder(ctx, parentPath, utils.VerbCreate)
}

// AuthorizeDeleteFolder checks if the user has permission to delete the folder at the
// specified path.
//
// Authorization is checked only against the folder itself. Permissions on the parent folder
// grant at least that level of access to all children, so checking the folder is sufficient.
// Individual nested resources are not checked separately.
//
// When folder metadata is enabled, the folder ID is determined by reading _folder.json.
//
// Example:
//
//	Deleting "team-a/project-x/" (containing dashboards A, B, C):
//	- Checks: delete permission on "team-a/project-x"
//	- Does NOT check: permissions on dashboard A, B, or C
//	- Reason: Parent folder permissions apply to all contents
func (a *ProvisioningAuthorizer) AuthorizeDeleteFolder(ctx context.Context, path string) error {
	return a.authorizeFolder(ctx, path, utils.VerbDelete)
}

// AuthorizeMoveFolder checks if the user has permission to move a folder from
// originalPath to targetPath.
//
// Moving a folder requires two permissions:
//  1. Update permission on the source folder (the folder being moved)
//  2. Create permission on the target parent folder (where it's being moved to)
//
// Individual nested resources are not checked separately. Permissions on the source folder
// apply to all its contents, so checking the folder itself is sufficient.
//
// When folder metadata is enabled, folder IDs are determined by reading _folder.json files.
//
// Example:
//
//	Moving "team-a/old-project/" to "team-b/new-project/":
//	- Checks: update permission on "team-a/old-project"
//	- Checks: create permission on "team-b" (parent of target)
//	- Does NOT check: permissions on contents of "old-project"
func (a *ProvisioningAuthorizer) AuthorizeMoveFolder(ctx context.Context, originalPath, targetPath string) error {
	// Check update permission on the source folder
	if err := a.authorizeFolder(ctx, originalPath, utils.VerbUpdate); err != nil {
		return err
	}

	// Check create permission on the target parent folder
	if targetPath == "" {
		return fmt.Errorf("target path cannot be empty")
	}

	parentPath := safepath.Dir(targetPath)
	if parentPath == "" {
		// Moving to root - check root folder permission
		return a.access.Check(ctx, authlib.CheckRequest{
			Group:    FolderResource.Group,
			Resource: FolderResource.Resource,
			Name:     "",
			Verb:     utils.VerbCreate,
		}, RootFolder(a.repo))
	}

	// Check create permission on the target parent folder
	return a.authorizeFolder(ctx, parentPath, utils.VerbCreate)
}

// AuthorizeWrite checks if writes are allowed to the specified ref.
// This delegates to the repository's write authorization logic.
func (a *ProvisioningAuthorizer) AuthorizeWrite(ctx context.Context, ref string) error {
	return repository.IsWriteAllowed(a.repo, ref)
}
