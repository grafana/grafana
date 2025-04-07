package resources

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
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
}

func NewDualReadWriter(repo repository.ReaderWriter, parser Parser, folders *FolderManager) *DualReadWriter {
	return &DualReadWriter{repo: repo, parser: parser, folders: folders}
}

func (r *DualReadWriter) Read(ctx context.Context, path string, ref string) (*ParsedResource, error) {
	// TODO: implement this
	if safepath.IsDir(path) {
		return nil, fmt.Errorf("folder read not supported")
	}

	info, err := r.repo.Read(ctx, path, ref)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	parsed, err := r.parser.Parse(ctx, info)
	if err != nil {
		return nil, fmt.Errorf("parse file: %w", err)
	}

	// Fail as we use the dry run for this response and it's not about updating the resource
	if err := parsed.DryRun(ctx); err != nil {
		return nil, fmt.Errorf("run dry run: %w", err)
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

	parsed, err := r.parser.Parse(ctx, info)
	if err != nil {
		return nil, fmt.Errorf("parse file: %w", err)
	}

	data, err = parsed.ToSaveBytes()
	if err != nil {
		return nil, err
	}

	if err := r.repo.Create(ctx, path, ref, data, message); err != nil {
		return nil, fmt.Errorf("create resource in repository: %w", err)
	}

	// Directly update the grafana database
	// Behaves the same running sync after writing
	// FIXME: to make sure if behaves in the same way as in sync, we should
	// we should refactor the code to use the same function.
	if ref == "" {
		if _, err := r.folders.EnsureFolderPathExist(ctx, path); err != nil {
			return nil, fmt.Errorf("ensure folder path exists: %w", err)
		}

		if err := parsed.Run(ctx); err != nil {
			return nil, fmt.Errorf("run resource: %w", err)
		}
	} else {
		if err := parsed.DryRun(ctx); err != nil {
			logger := logging.FromContext(ctx).With("path", path, "name", parsed.Obj.GetName(), "ref", ref)
			logger.Warn("failed to dry run resource on create", "error", err)
			// Do not fail here as it's purely informational
			parsed.Errors = append(parsed.Errors, err.Error())
		}
	}

	return parsed, nil
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
	parsed, err := r.parser.Parse(ctx, info)
	if err != nil {
		return nil, fmt.Errorf("parse file: %w", err)
	}

	data, err = parsed.ToSaveBytes()
	if err != nil {
		return nil, err
	}

	if err = r.repo.Update(ctx, path, ref, data, message); err != nil {
		return nil, fmt.Errorf("update resource in repository: %w", err)
	}

	// Directly update the grafana database
	// Behaves the same running sync after writing
	// FIXME: to make sure if behaves in the same way as in sync, we should
	// we should refactor the code to use the same function.
	if ref == "" {
		if _, err := r.folders.EnsureFolderPathExist(ctx, path); err != nil {
			return nil, fmt.Errorf("ensure folder path exists: %w", err)
		}

		if err := parsed.Run(ctx); err != nil {
			return nil, fmt.Errorf("run resource: %w", err)
		}
	} else {
		if err := parsed.DryRun(ctx); err != nil {
			// Do not fail here as it's purely informational
			logger := logging.FromContext(ctx).With("path", path, "name", parsed.Obj.GetName(), "ref", ref)
			logger.Warn("failed to dry run resource on update", "error", err)
			parsed.Errors = append(parsed.Errors, err.Error())
		}
	}

	return parsed, nil
}
