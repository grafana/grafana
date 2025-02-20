package provisioning

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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

func (s *filesConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	logger := logging.FromContext(ctx).With("logger", "files-connector", "repository_name", name)
	ctx = logging.Context(ctx, logger)
	repo, err := s.getter.GetRepository(ctx, name)
	if err != nil {
		logger.Debug("failed to find repository", "error", err)
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		ref := query.Get("ref")
		message := query.Get("message")
		logger := logger.With("url", r.URL.Path, "ref", ref, "message", message)
		ctx := logging.Context(r.Context(), logger)

		prefix := fmt.Sprintf("/%s/files", name)
		idx := strings.Index(r.URL.Path, prefix)
		if idx == -1 {
			logger.Debug("failed to find a file path in the URL")
			responder.Error(apierrors.NewBadRequest("invalid request path"))
			return
		}

		filePath := strings.TrimPrefix(r.URL.Path[idx+len(prefix):], "/")
		isFolderPath := strings.HasSuffix(filePath, "/")

		if r.Method == http.MethodGet && (filePath == "" || isFolderPath) {
			if len(filePath) > 0 {
				responder.Error(apierrors.NewBadRequest("folder navigation not yet supported"))
				return
			}

			rsp, err := repo.ReadTree(ctx, ref)
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

		if !isFolderPath {
			switch path.Ext(filePath) {
			case ".json", ".yaml", ".yml":
				// ok
			default:
				logger.Debug("got a file extension that was not JSON or YAML", "extension", path.Ext(filePath))
				responder.Error(apierrors.NewBadRequest("only yaml and json files supported"))
				return
			}
		}

		var obj *provisioning.ResourceWrapper
		code := http.StatusOK
		switch r.Method {
		case http.MethodGet:
			code, obj, err = s.doRead(ctx, repo, filePath, ref)
		case http.MethodPost:
			obj, err = s.doWrite(ctx, false, repo, filePath, ref, message, r)
		case http.MethodPut:
			if isFolderPath {
				err = apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method)
			} else {
				obj, err = s.doWrite(ctx, true, repo, filePath, ref, message, r)
			}
		case http.MethodDelete:
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
	}), nil
}

func (s *filesConnector) doRead(ctx context.Context, repo repository.Repository, path string, ref string) (int, *provisioning.ResourceWrapper, error) {
	info, err := repo.Read(ctx, path, ref)
	if err != nil {
		return 0, nil, err
	}
	if strings.HasPrefix(info.Path, "/") {
		return 0, nil, fmt.Errorf("repository path must be relative to the root")
	}

	parser, err := s.parsers.GetParser(ctx, repo)
	if err != nil {
		return 0, nil, err
	}

	parsed, err := parser.Parse(ctx, info, true)
	if err != nil {
		return 0, nil, err
	}

	// GVR will exist for anything we can actually save (dashboard/playlist for now)
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

	defer func() { _ = req.Body.Close() }()
	if strings.HasSuffix(path, "/") {
		if err := repo.Create(ctx, path, ref, nil, message); err != nil {
			return nil, fmt.Errorf("failed to create folder: %w", err)
		}
		return &provisioning.ResourceWrapper{
			Path:      path,
			Ref:       ref,
			Timestamp: &metav1.Time{Time: time.Now()},
			// TODO: should we return something here?
			// TypeMeta:  metav1.TypeMeta{},
			// Resource: provisioning.ResourceObjects{},
		}, nil
	}

	data, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}

	info := &repository.FileInfo{
		Data: data,
		Path: path,
		Ref:  ref,
	}

	parser, err := s.parsers.GetParser(ctx, repo)
	if err != nil {
		return nil, err
	}

	parsed, err := parser.Parse(ctx, info, true)
	if err != nil {
		if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
			return nil, apierrors.NewBadRequest("unable to read the request as a resource")
		}
		return nil, err
	}

	// GVR will exist for anything we can actually save (dashboard/playlist for now)
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
		err = repo.Update(ctx, path, ref, data, message)
	} else {
		err = repo.Create(ctx, path, ref, data, message)
	}
	if err != nil {
		return nil, err
	}

	// Which context?  request of background???
	// Behaves the same running sync after writing
	if parsed.Existing == nil {
		obj, err := parsed.Client.Create(ctx, parsed.Obj, metav1.CreateOptions{})
		if err != nil {
			parsed.Errors = append(parsed.Errors, err)
		} else {
			parsed.Obj = obj
		}
	} else {
		obj, err := parsed.Client.Update(ctx, parsed.Obj, metav1.UpdateOptions{})
		if err != nil {
			parsed.Errors = append(parsed.Errors, err)
		} else {
			parsed.Obj = obj
		}
	}

	return parsed.AsResourceWrapper(), err
}

func (s *filesConnector) doDelete(ctx context.Context, repo repository.Repository, path string, ref string, message string) (*provisioning.ResourceWrapper, error) {
	if err := repository.IsWriteAllowed(repo.Config(), ref); err != nil {
		return nil, err
	}

	err := repo.Delete(ctx, path, ref, message)
	if err != nil {
		return nil, err
	}

	logger := logging.FromContext(ctx).With("path", path)
	logger.Info("TODO! trigger sync for this file we just deleted...")

	return &provisioning.ResourceWrapper{
		Path: path,
		// TODO: should we return the deleted object and / or commit?
	}, nil
}

var (
	_ rest.Storage         = (*filesConnector)(nil)
	_ rest.Connecter       = (*filesConnector)(nil)
	_ rest.StorageMetadata = (*filesConnector)(nil)
)
