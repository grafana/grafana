package provisioning

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

const (
	// Files endpoint max size for dashboards etc (5MB)
	filesMaxBodySize = 5 * 1024 * 1024
)

type filesConnector struct {
	getter  RepoGetter
	parsers *resources.ParserFactory
}

func (*filesConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &provisioning.ResourceWrapper{}
}

func (*filesConnector) Destroy() {}

func (*filesConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*filesConnector) ProducesObject(verb string) any {
	return &provisioning.ResourceWrapper{}
}

func (*filesConnector) ConnectMethods() []string {
	return []string{http.MethodGet, http.MethodPut, http.MethodPost, http.MethodDelete}
}

func (*filesConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, "" // true adds the {path} component
}

// TODO: document the synchronous write and delete on the API Spec
// TODO: Move dual write logic to `resources` package and keep this connector simple
func (s *filesConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	logger := logging.FromContext(ctx).With("logger", "files-connector", "repository_name", name)
	ctx = logging.Context(ctx, logger)
	repo, err := s.getter.GetRepository(ctx, name)
	if err != nil {
		logger.Debug("failed to find repository", "error", err)
		return nil, err
	}

	reader, ok := repo.(repository.Reader)
	if !ok {
		return nil, apierrors.NewBadRequest("repository does not support read")
	}

	return withTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		ref := query.Get("ref")
		message := query.Get("message")
		logger := logger.With("url", r.URL.Path, "ref", ref, "message", message)
		ctx := logging.Context(r.Context(), logger)

		filePath, err := pathAfterPrefix(r.URL.Path, fmt.Sprintf("/%s/files", name))
		if err != nil {
			responder.Error(apierrors.NewBadRequest(err.Error()))
			return
		}

		if err := resources.IsPathSupported(filePath); err != nil {
			responder.Error(apierrors.NewBadRequest(err.Error()))
			return
		}

		isDir := safepath.IsDir(filePath)
		if r.Method == http.MethodGet && isDir {
			// TODO: Implement folder navigation
			if len(filePath) > 0 {
				responder.Error(apierrors.NewBadRequest("folder navigation not yet supported"))
				return
			}

			// TODO: Add pagination
			rsp, err := reader.ReadTree(ctx, ref)
			if err != nil {
				responder.Error(err)
				return
			}

			files := &provisioning.FileList{}
			for _, v := range rsp {
				if !v.Blob {
					continue // folder item
				}
				files.Items = append(files.Items, provisioning.FileItem{
					Path: v.Path,
					Size: v.Size,
					Hash: v.Hash,
				})
			}
			responder.Object(http.StatusOK, files)
			return
		}

		if filePath == "" {
			responder.Error(apierrors.NewBadRequest("path is required"))
			return
		}

		// TODO: Implement folder delete
		if r.Method == http.MethodDelete && isDir {
			responder.Error(apierrors.NewBadRequest("folder navigation not yet supported"))
			return
		}

		var obj *provisioning.ResourceWrapper
		code := http.StatusOK
		switch r.Method {
		case http.MethodGet:
			code, obj, err = s.doRead(ctx, reader, filePath, ref)
		case http.MethodPost:
			obj, err = s.doWrite(ctx, false, repo, filePath, ref, message, r)
		case http.MethodPut:
			// TODO: document in API specification
			if isDir {
				err = apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method)
			} else {
				obj, err = s.doWrite(ctx, true, repo, filePath, ref, message, r)
			}
		case http.MethodDelete:
			// TODO: limit file size
			obj, err = s.doDelete(ctx, repo, filePath, ref, message)
		default:
			err = apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method)
		}

		if err != nil {
			logger.Debug("got an error after processing request", "error", err)
			responder.Error(err)
			return
		}

		// something failed
		if len(obj.Errors) > 0 {
			code = http.StatusInternalServerError
		}

		logger.Debug("request resulted in valid object", "object", obj)
		responder.Object(code, obj)
	}), 30*time.Second), nil
}

func (s *filesConnector) doRead(ctx context.Context, repo repository.Reader, path string, ref string) (int, *provisioning.ResourceWrapper, error) {
	info, err := repo.Read(ctx, path, ref)
	if err != nil {
		return 0, nil, err
	}

	parser, err := s.parsers.GetParser(ctx, repo)
	if err != nil {
		return 0, nil, err
	}

	parsed, err := parser.Parse(ctx, info, true)
	if err != nil {
		return 0, nil, err
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

	code := http.StatusOK
	if len(parsed.Errors) > 0 {
		code = http.StatusNotAcceptable
	}
	return code, parsed.AsResourceWrapper(), nil
}

func (s *filesConnector) doWrite(ctx context.Context, update bool, repo repository.Repository, path string, ref string, message string, req *http.Request) (*provisioning.ResourceWrapper, error) {
	if err := repository.IsWriteAllowed(repo.Config(), ref); err != nil {
		return nil, err
	}

	writer, ok := repo.(repository.ReaderWriter)
	if !ok {
		return nil, apierrors.NewBadRequest("repository does not support read-writing")
	}

	parser, err := s.parsers.GetParser(ctx, writer)
	if err != nil {
		return nil, err
	}

	defer func() { _ = req.Body.Close() }()
	if safepath.IsDir(path) {
		return s.doCreateFolder(ctx, writer, path, ref, message, parser)
	}

	data, err := readBody(req, filesMaxBodySize)
	if err != nil {
		return nil, err
	}

	info := &repository.FileInfo{
		Data: data,
		Path: path,
		Ref:  ref,
	}

	// TODO: improve parser to parse out of reader
	parsed, err := parser.Parse(ctx, info, true)
	if err != nil {
		if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
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
		return parsed.AsResourceWrapper(), err
	}

	data, err = parsed.ToSaveBytes()
	if err != nil {
		return nil, err
	}

	if update {
		err = writer.Update(ctx, path, ref, data, message)
	} else {
		err = writer.Create(ctx, path, ref, data, message)
	}
	if err != nil {
		return nil, err
	}

	// Directly update the grafana database
	// Behaves the same running sync after writing
	if ref == "" {
		if parsed.Existing == nil {
			parsed.Upsert, err = parsed.Client.Create(ctx, parsed.Obj, metav1.CreateOptions{})
			if err != nil {
				parsed.Errors = append(parsed.Errors, err)
			}
		} else {
			parsed.Upsert, err = parsed.Client.Update(ctx, parsed.Obj, metav1.UpdateOptions{})
			if err != nil {
				parsed.Errors = append(parsed.Errors, err)
			}
		}
	}

	return parsed.AsResourceWrapper(), err
}

func (s *filesConnector) doCreateFolder(ctx context.Context, repo repository.Writer, path string, ref string, message string, parser *resources.Parser) (*provisioning.ResourceWrapper, error) {
	client, err := parser.Clients().Folder()
	if err != nil {
		return nil, err
	}
	manager := resources.NewFolderManager(repo, client)

	// Now actually create the folder
	if err := repo.Create(ctx, path, ref, nil, message); err != nil {
		return nil, fmt.Errorf("failed to create folder: %w", err)
	}

	cfg := repo.Config()
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
		folderName, err := manager.EnsureFolderPathExist(ctx, path)
		if err != nil {
			return nil, err
		}

		current, err := manager.GetFolder(ctx, folderName)
		if err != nil && !apierrors.IsNotFound(err) {
			return nil, err // unable to check if the folder exists
		}
		wrap.Resource.Upsert = v0alpha1.Unstructured{
			Object: current.Object,
		}
	}

	return wrap, nil
}

// Deletes a file from the repository and the Grafana database.
// If the path is a folder, it will return an error.
// If the file is not parsable, it will return an error.
func (s *filesConnector) doDelete(ctx context.Context, repo repository.Repository, path string, ref string, message string) (*provisioning.ResourceWrapper, error) {
	if err := repository.IsWriteAllowed(repo.Config(), ref); err != nil {
		return nil, err
	}

	// Read the existing value
	access, ok := repo.(repository.ReaderWriter)
	if !ok {
		return nil, fmt.Errorf("repository is not read+writeable")
	}

	file, err := access.Read(ctx, path, ref)
	if err != nil {
		return nil, err // unable to read value
	}

	parser, err := s.parsers.GetParser(ctx, access)
	if err != nil {
		return nil, err // unable to read value
	}

	// TODO: document in API specification
	// We can only delete parsable things
	parsed, err := parser.Parse(ctx, file, false)
	if err != nil {
		return nil, err // unable to read value
	}

	parsed.Action = provisioning.ResourceActionDelete
	wrap := parsed.AsResourceWrapper()

	// Now delete the file
	err = access.Delete(ctx, path, ref, message)
	if err != nil {
		return nil, err
	}

	// Delete the file in the grafana database
	if ref == "" {
		err = parsed.Client.Delete(ctx, parsed.Obj.GetName(), metav1.DeleteOptions{})
		if apierrors.IsNotFound(err) {
			err = nil // ignorable
		}
	}

	return wrap, err
}

var (
	_ rest.Storage         = (*filesConnector)(nil)
	_ rest.Connecter       = (*filesConnector)(nil)
	_ rest.StorageMetadata = (*filesConnector)(nil)
)
