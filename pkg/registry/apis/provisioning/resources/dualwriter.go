package resources

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

// DualReadWriter is a wrapper around a repository that can read and write resources
// TODO: it does not support folders yet
type DualReadWriter struct {
	repo    repository.ReaderWriter
	parser  *Parser
	folders *FolderManager
}

func NewDualReadWriter(repo repository.ReaderWriter, parser *Parser, folders *FolderManager) *DualReadWriter {
	return &DualReadWriter{repo: repo, parser: parser, folders: folders}
}

func (r *DualReadWriter) Read(ctx context.Context, path string, ref string) (*ParsedResource, error) {
	// TODO: implement this
	if safepath.IsDir(path) {
		return nil, fmt.Errorf("folder read not supported")
	}

	info, err := r.repo.Read(ctx, path, ref)
	if err != nil {
		return nil, err
	}

	parsed, err := r.parser.Parse(ctx, info, true)
	if err != nil {
		return nil, err
	}

	// GVR will exist for anything we can actually save
	// TODO: Add known error in parser for unsupported resource
	if parsed.GVR == nil {
		if parsed.GVK != nil {
			//nolint:govet
			parsed.Errors = append(parsed.Errors, fmt.Errorf("unknown resource for Kind: %s", parsed.GVK.Kind))
		} else {
			parsed.Errors = append(parsed.Errors, fmt.Errorf("unknown resource"))
		}
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
		return nil, err // unable to read value
	}

	// TODO: document in API specification
	// We can only delete parsable things
	parsed, err := r.parser.Parse(ctx, file, false)
	if err != nil {
		return nil, err // unable to read value
	}

	parsed.Action = provisioning.ResourceActionDelete
	err = r.repo.Delete(ctx, path, ref, message)
	if err != nil {
		return nil, fmt.Errorf("delete file from repository: %w", err)
	}

	// Delete the file in the grafana database
	if ref == "" {
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
	if err := repository.IsWriteAllowed(r.repo.Config(), ref); err != nil {
		return nil, err
	}

	info := &repository.FileInfo{
		Data: data,
		Path: path,
		Ref:  ref,
	}

	// TODO: improve parser to parse out of reader
	parsed, err := r.parser.Parse(ctx, info, true)
	if err != nil {
		if errors.Is(err, ErrUnableToReadResourceBytes) {
			return nil, apierrors.NewBadRequest("unable to read the request as a resource")
		}

		return nil, err
	}

	// GVR will exist for anything we can actually save
	// TODO: Add known error in parser for unsupported resource
	if parsed.GVR == nil {
		return nil, apierrors.NewBadRequest("The payload does not map to a known resource")
	}

	// Do not write if any errors exist
	if len(parsed.Errors) > 0 {
		return parsed, err
	}

	data, err = parsed.ToSaveBytes()
	if err != nil {
		return nil, err
	}

	err = r.repo.Create(ctx, path, ref, data, message)
	if err != nil {
		return nil, fmt.Errorf("create resource in repository: %w", err)
	}

	// Directly update the grafana database
	// Behaves the same running sync after writing
	// FIXME: to make sure if behaves in the same way as in sync, we should
	// we should refactor the code to use the same function.
	if ref == "" {
		if err := r.writeParsed(ctx, path, parsed); err != nil {
			parsed.Errors = append(parsed.Errors, err)
		}
	}

	return parsed, err
}

// UpdateResource updates a resource in the repository
func (r *DualReadWriter) UpdateResource(ctx context.Context, path string, ref string, message string, data []byte) (*ParsedResource, error) {
	if err := repository.IsWriteAllowed(r.repo.Config(), ref); err != nil {
		return nil, err
	}

	info := &repository.FileInfo{
		Data: data,
		Path: path,
		Ref:  ref,
	}

	// TODO: improve parser to parse out of reader
	parsed, err := r.parser.Parse(ctx, info, true)
	if err != nil {
		if errors.Is(err, ErrUnableToReadResourceBytes) {
			return nil, apierrors.NewBadRequest("unable to read the request as a resource")
		}

		return nil, err
	}

	// GVR will exist for anything we can actually save
	// TODO: Add known error in parser for unsupported resource
	if parsed.GVR == nil {
		return nil, apierrors.NewBadRequest("The payload does not map to a known resource")
	}

	// Do not write if any errors exist
	if len(parsed.Errors) > 0 {
		return parsed, err
	}

	data, err = parsed.ToSaveBytes()
	if err != nil {
		return nil, err
	}

	err = r.repo.Update(ctx, path, ref, data, message)
	if err != nil {
		return nil, fmt.Errorf("update resource in repository: %w", err)
	}

	// Directly update the grafana database
	// Behaves the same running sync after writing
	// FIXME: to make sure if behaves in the same way as in sync, we should
	// we should refactor the code to use the same function.
	if ref == "" {
		if err := r.writeParsed(ctx, path, parsed); err != nil {
			parsed.Errors = append(parsed.Errors, err)
		}
	}

	return parsed, err
}

// writeParsed write parsed resource to the repository and grafana database
func (r *DualReadWriter) writeParsed(ctx context.Context, path string, parsed *ParsedResource) error {
	if _, err := r.folders.EnsureFolderPathExist(ctx, path); err != nil {
		return fmt.Errorf("ensure folder path exists: %w", err)
	}

	// FIXME: I don't like this parsed strategy here
	var err error
	if parsed.Existing == nil {
		parsed.Upsert, err = parsed.Client.Create(ctx, parsed.Obj, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("create resource: %w", err)
		}
	} else {
		parsed.Upsert, err = parsed.Client.Update(ctx, parsed.Obj, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("update resource: %w", err)
		}
	}

	return nil
}
