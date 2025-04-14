package resources

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

// DualReadWriter is a wrapper around a repository that can read and write resources
// TODO: it does not support folders yet
type DualReadWriter struct {
	repo    repository.ReaderWriter
	parser  Parser
	folders *FolderManager
	access  authlib.AccessChecker
}

func NewDualReadWriter(repo repository.ReaderWriter, parser Parser, folders *FolderManager, access authlib.AccessChecker) *DualReadWriter {
	return &DualReadWriter{repo: repo, parser: parser, folders: folders, access: access}
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
		return nil, apierrors.NewBadRequest(fmt.Sprintf("Dry run failed: %v", err))
	}

	// Authorize based on the existing resource
	if err = r.authorize(ctx, parsed, utils.VerbGet); err != nil {
		return nil, err
	}

	return parsed, nil
}

func (r *DualReadWriter) Delete(ctx context.Context, path string, ref string, message string) (*ParsedResource, error) {
	if err := repository.IsWriteAllowed(r.repo.Config(), ref); err != nil {
		return nil, err
	}

	// TODO: implement this
	if safepath.IsDir(path) {
		return nil, fmt.Errorf("folder delete not supported")
	}

	file, err := r.repo.Read(ctx, path, ref)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	// TODO: document in API specification
	// We can only delete parsable things
	parsed, err := r.parser.Parse(ctx, file)
	if err != nil {
		return nil, fmt.Errorf("parse file: %w", err)
	}

	if err = r.authorize(ctx, parsed, utils.VerbDelete); err != nil {
		return nil, err
	}

	parsed.Action = provisioning.ResourceActionDelete
	err = r.repo.Delete(ctx, path, ref, message)
	if err != nil {
		return nil, fmt.Errorf("delete file from repository: %w", err)
	}

	// Delete the file in the grafana database
	if ref == "" {
		ctx, _, err := identity.WithProvisioningIdentity(ctx, parsed.Obj.GetNamespace())
		if err != nil {
			return parsed, err
		}

		// FIXME: empty folders with no repository files will remain in the system
		// until the next reconciliation.
		err = parsed.Client.Delete(ctx, parsed.Obj.GetName(), metav1.DeleteOptions{})
		if apierrors.IsNotFound(err) {
			err = nil // ignorable
		}

		if err != nil {
			return nil, fmt.Errorf("delete resource from storage: %w", err)
		}
	}

	return parsed, err
}

// CreateFolder creates a new folder in the repository
// FIXME: fix signature to return ParsedResource
func (r *DualReadWriter) CreateFolder(ctx context.Context, path string, ref string, message string) (*provisioning.ResourceWrapper, error) {
	if err := repository.IsWriteAllowed(r.repo.Config(), ref); err != nil {
		return nil, err
	}

	if !safepath.IsDir(path) {
		return nil, fmt.Errorf("not a folder path")
	}

	if err := r.authorizeCreateFolder(ctx, path); err != nil {
		return nil, err
	}

	// Now actually create the folder
	if err := r.repo.Create(ctx, path, ref, nil, message); err != nil {
		return nil, fmt.Errorf("failed to create folder: %w", err)
	}

	cfg := r.repo.Config()
	wrap := &provisioning.ResourceWrapper{
		Path: path,
		Ref:  ref,
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

	if ref == "" {
		folderName, err := r.folders.EnsureFolderPathExist(ctx, path)
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
func (r *DualReadWriter) CreateResource(ctx context.Context, path string, ref string, message string, data []byte) (*ParsedResource, error) {
	return r.createOrUpdate(ctx, true, path, ref, message, data)
}

// UpdateResource updates a resource in the repository
func (r *DualReadWriter) UpdateResource(ctx context.Context, path string, ref string, message string, data []byte) (*ParsedResource, error) {
	return r.createOrUpdate(ctx, false, path, ref, message, data)
}

// Create or updates a resource in the repository
func (r *DualReadWriter) createOrUpdate(ctx context.Context, create bool, path string, ref string, message string, data []byte) (*ParsedResource, error) {
	if err := repository.IsWriteAllowed(r.repo.Config(), ref); err != nil {
		return nil, err
	}

	info := &repository.FileInfo{
		Data: data,
		Path: path,
		Ref:  ref,
	}

	parsed, err := r.parser.Parse(ctx, info)
	if err != nil {
		return nil, err
	}

	// Make sure the value is valid
	if err := parsed.DryRun(ctx); err != nil {
		logger := logging.FromContext(ctx).With("path", path, "name", parsed.Obj.GetName(), "ref", ref)
		logger.Warn("failed to dry run resource on create", "error", err)

		// TODO: return this as a 400 rather than 500
		return nil, fmt.Errorf("error running dryRun %w", err)
	}

	if len(parsed.Errors) > 0 {
		// TODO: return this as a 400 rather than 500
		return nil, fmt.Errorf("errors while parsing file [%v]", parsed.Errors)
	}

	// Verify that we can create (or update) the referenced resource
	verb := utils.VerbUpdate
	if parsed.Action == provisioning.ResourceActionCreate {
		verb = utils.VerbCreate
	}
	if err = r.authorize(ctx, parsed, verb); err != nil {
		return nil, err
	}

	data, err = parsed.ToSaveBytes()
	if err != nil {
		return nil, err
	}

	// Always use the provisioning identity when writing
	ctx, _, err = identity.WithProvisioningIdentity(ctx, parsed.Obj.GetNamespace())
	if err != nil {
		return nil, fmt.Errorf("unable to use provisioning identity %w", err)
	}

	// Create or update
	if create {
		err = r.repo.Create(ctx, path, ref, data, message)
	} else {
		err = r.repo.Update(ctx, path, ref, data, message)
	}
	if err != nil {
		return nil, err // raw error is useful
	}

	// Directly update the grafana database
	// Behaves the same running sync after writing
	// FIXME: to make sure if behaves in the same way as in sync, we should
	// we should refactor the code to use the same function.
	if ref == "" && parsed.Client != nil {
		if _, err := r.folders.EnsureFolderPathExist(ctx, path); err != nil {
			return nil, fmt.Errorf("ensure folder path exists: %w", err)
		}

		err = parsed.Run(ctx)
	}

	return parsed, err
}

func (r *DualReadWriter) authorize(ctx context.Context, parsed *ParsedResource, verb string) error {
	id, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized(err.Error())
	}

	// Use configured permissions for get+delete
	if parsed.Existing != nil && (verb == utils.VerbGet || verb == utils.VerbDelete) {
		rsp, err := r.access.Check(ctx, id, authlib.CheckRequest{
			Group:     parsed.GVR.Group,
			Resource:  parsed.GVR.Resource,
			Namespace: parsed.Existing.GetNamespace(),
			Name:      parsed.Existing.GetName(),
			Folder:    parsed.Meta.GetFolder(),
			Verb:      utils.VerbGet,
		})
		if err != nil || !rsp.Allowed {
			return apierrors.NewForbidden(parsed.GVR.GroupResource(), parsed.Obj.GetName(),
				fmt.Errorf("no access to read the embedded file"))
		}
	}

	// Simple role based access for now
	if id.GetOrgRole().Includes(identity.RoleEditor) {
		return nil
	}

	return apierrors.NewForbidden(parsed.GVR.GroupResource(), parsed.Obj.GetName(),
		fmt.Errorf("must be admin or editor to access files from provisioning"))
}

func (r *DualReadWriter) authorizeCreateFolder(ctx context.Context, _ string) error {
	id, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized(err.Error())
	}

	// Simple role based access for now
	if id.GetOrgRole().Includes(identity.RoleEditor) {
		return nil
	}

	return apierrors.NewForbidden(FolderResource.GroupResource(), "",
		fmt.Errorf("must be admin or editor to access folders with provisioning"))
}
