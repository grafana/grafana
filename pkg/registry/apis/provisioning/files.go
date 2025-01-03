package provisioning

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type filesConnector struct {
	getter  RepoGetter
	parsers *resources.ParserFactory
	logger  *slog.Logger
}

func (*filesConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &provisioning.ResourceWrapper{}
}

func (*filesConnector) Destroy() {}

func (*filesConnector) NamespaceScoped() bool {
	return true
}

func (*filesConnector) GetSingularName() string {
	return "Resource"
}

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
	logger := s.logger.With("repository_name", name)
	repo, err := s.getter.GetRepository(ctx, name)
	if err != nil {
		logger.DebugContext(ctx, "failed to find repository", "error", err)
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		ref := query.Get("ref")
		message := query.Get("message")
		logger = logger.With("url", r.URL.Path, "ref", ref, "message", message)

		prefix := fmt.Sprintf("/%s/files", name)
		idx := strings.Index(r.URL.Path, prefix)
		if idx == -1 {
			logger.DebugContext(r.Context(), "failed to find a file path in the URL")
			responder.Error(apierrors.NewBadRequest("invalid request path"))
			return
		}

		filePath := strings.TrimPrefix(r.URL.Path[idx+len(prefix):], "/")
		if filePath == "" || strings.HasSuffix(filePath, "/") {
			if len(filePath) > 0 {
				responder.Error(apierrors.NewBadRequest("folder navigation not yet supported"))
				return
			}

			rsp, err := repo.ReadTree(r.Context(), logger, ref)
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

		switch path.Ext(filePath) {
		case ".json", ".yaml", ".yml":
			// ok
		default:
			logger.DebugContext(r.Context(), "got a file extension that was not JSON or YAML", "extension", path.Ext(filePath))
			responder.Error(apierrors.NewBadRequest("only yaml and json files supported"))
			return
		}

		var obj *provisioning.ResourceWrapper
		code := http.StatusOK
		switch r.Method {
		case http.MethodGet:
			code, obj, err = s.doRead(r.Context(), logger, repo, filePath, ref)
		case http.MethodPost:
			obj, err = s.doWrite(r.Context(), logger, false, repo, filePath, ref, message, r)
		case http.MethodPut:
			obj, err = s.doWrite(r.Context(), logger, true, repo, filePath, ref, message, r)
		case http.MethodDelete:
			obj, err = s.doDelete(r.Context(), logger, repo, filePath, ref, message)
		default:
			err = apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method)
		}

		if err != nil {
			logger.DebugContext(ctx, "got an error after processing request", "error", err)
			responder.Error(err)
			return
		}
		logger.DebugContext(ctx, "request resulted in valid object", "object", obj)
		responder.Object(code, obj)
	}), nil
}

func (s *filesConnector) doRead(ctx context.Context, logger *slog.Logger, repo repository.Repository, path string, ref string) (int, *provisioning.ResourceWrapper, error) {
	info, err := repo.Read(ctx, logger, path, ref)
	if err != nil {
		return 0, nil, err
	}

	parser, err := s.parsers.GetParser(repo)
	if err != nil {
		return 0, nil, err
	}

	parsed, err := parser.Parse(ctx, logger, info, true)
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

func (s *filesConnector) doWrite(ctx context.Context, logger *slog.Logger, update bool, repo repository.Repository, path string, ref string, message string, req *http.Request) (*provisioning.ResourceWrapper, error) {
	settings := repo.Config().Spec.Editing
	if update && !settings.Update {
		return nil, apierrors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), "updating files not enabled", nil)
	} else if !settings.Create {
		return nil, apierrors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), "creating files not enabled", nil)
	}

	defer func() { _ = req.Body.Close() }()
	data, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}

	info := &repository.FileInfo{
		Data: data,
		Path: path,
		Ref:  ref,
	}

	parser, err := s.parsers.GetParser(repo)
	if err != nil {
		return nil, err
	}

	parsed, err := parser.Parse(ctx, logger, info, true)
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

	data, err = parsed.ToSaveBytes()
	if err != nil {
		return nil, err
	}

	if update {
		err = repo.Update(ctx, logger, path, ref, data, message)
	} else {
		err = repo.Create(ctx, logger, path, ref, data, message)
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

func (s *filesConnector) doDelete(ctx context.Context, logger *slog.Logger, repo repository.Repository, path string, ref string, message string) (*provisioning.ResourceWrapper, error) {
	settings := repo.Config().Spec.Editing
	if !settings.Delete {
		return nil, apierrors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), "deleting is not supported", nil)
	}

	err := repo.Delete(ctx, logger, path, ref, message)
	if err != nil {
		return nil, err
	}

	fmt.Printf("TODO! trigger sync for this file we just deleted... %s\n", path)

	return &provisioning.ResourceWrapper{
		Path: path,
		// TODO: should we return the deleted object and / or commit?
	}, nil
}

var (
	_ rest.Storage              = (*filesConnector)(nil)
	_ rest.Connecter            = (*filesConnector)(nil)
	_ rest.Scoper               = (*filesConnector)(nil)
	_ rest.SingularNameProvider = (*filesConnector)(nil)
	_ rest.StorageMetadata      = (*filesConnector)(nil)
)
