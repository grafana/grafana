package provisioning

import (
	"context"
	"fmt"
	"net/http"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	access  authlib.AccessChecker
	parsers resources.ParserFactory
	clients resources.ClientFactory
}

func NewFilesConnector(getter RepoGetter, parsers resources.ParserFactory, clients resources.ClientFactory, access authlib.AccessChecker) *filesConnector {
	return &filesConnector{getter: getter, parsers: parsers, clients: clients, access: access}
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
func (c *filesConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	logger := logging.FromContext(ctx).With("logger", "files-connector", "repository_name", name)
	ctx = logging.Context(ctx, logger)
	repo, err := c.getter.GetHealthyRepository(ctx, name)
	if err != nil {
		logger.Debug("failed to find repository", "error", err)
		return nil, err
	}

	readWriter, ok := repo.(repository.ReaderWriter)
	if !ok {
		return nil, apierrors.NewBadRequest("repository does not support read-writing")
	}

	parser, err := c.parsers.GetParser(ctx, readWriter)
	if err != nil {
		return nil, fmt.Errorf("failed to get parser: %w", err)
	}

	clients, err := c.clients.Clients(ctx, repo.Config().Namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to get clients: %w", err)
	}

	folderClient, err := clients.Folder()
	if err != nil {
		return nil, fmt.Errorf("failed to get folder client: %w", err)
	}
	folders := resources.NewFolderManager(readWriter, folderClient, resources.NewEmptyFolderTree())
	dualReadWriter := resources.NewDualReadWriter(readWriter, parser, folders, c.access)

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
			files, err := c.listFolderFiles(ctx, filePath, ref, readWriter)
			if err != nil {
				responder.Error(err)
				return
			}

			responder.Object(http.StatusOK, files)
			return
		}

		if filePath == "" {
			responder.Error(apierrors.NewBadRequest("missing request path"))
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
			resource, err := dualReadWriter.Read(ctx, filePath, ref)
			if err != nil {
				responder.Error(err)
				return
			}
			obj = resource.AsResourceWrapper()
		case http.MethodPost:
			if isDir {
				obj, err = dualReadWriter.CreateFolder(ctx, filePath, ref, message)
			} else {
				data, err := readBody(r, filesMaxBodySize)
				if err != nil {
					responder.Error(err)
					return
				}

				resource, err := dualReadWriter.CreateResource(ctx, filePath, ref, message, data)
				if err != nil {
					responder.Error(err)
					return
				}
				obj = resource.AsResourceWrapper()
			}
		case http.MethodPut:
			// TODO: document in API specification
			if isDir {
				err = apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method)
			} else {
				data, err := readBody(r, filesMaxBodySize)
				if err != nil {
					responder.Error(err)
					return
				}

				resource, err := dualReadWriter.UpdateResource(ctx, filePath, ref, message, data)
				if err != nil {
					responder.Error(err)
					return
				}
				obj = resource.AsResourceWrapper()
			}
		case http.MethodDelete:
			resource, err := dualReadWriter.Delete(ctx, filePath, ref, message)
			if err != nil {
				responder.Error(err)
				return
			}
			obj = resource.AsResourceWrapper()
		default:
			err = apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method)
		}

		if err != nil {
			logger.Debug("got an error after processing request", "error", err)
			responder.Error(err)
			return
		}

		if len(obj.Errors) > 0 {
			code = http.StatusPartialContent
		}

		logger.Debug("request resulted in valid object", "object", obj)
		responder.Object(code, obj)
	}), 30*time.Second), nil
}

// listFolderFiles returns a list of files in a folder
func (c *filesConnector) listFolderFiles(ctx context.Context, filePath string, ref string, readWriter repository.ReaderWriter) (*provisioning.FileList, error) {
	id, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("missing auth info in context")
	}

	// TODO: replace with access check on the repo itself
	if !id.GetOrgRole().Includes(identity.RoleAdmin) {
		return nil, apierrors.NewForbidden(resources.DashboardResource.GroupResource(), "",
			fmt.Errorf("requires admin role"))
	}

	// TODO: Implement folder navigation
	if len(filePath) > 0 {
		return nil, apierrors.NewBadRequest("folder navigation not yet supported")
	}

	// TODO: Add pagination
	rsp, err := readWriter.ReadTree(ctx, ref)
	if err != nil {
		return nil, err
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

	return files, nil
}

var (
	_ rest.Storage         = (*filesConnector)(nil)
	_ rest.Connecter       = (*filesConnector)(nil)
	_ rest.StorageMetadata = (*filesConnector)(nil)
)
