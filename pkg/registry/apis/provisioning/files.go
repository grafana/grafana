package provisioning

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path/filepath"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type filesConnector struct {
	getter RepoGetter
	client *resourceClient
	logger *slog.Logger
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
		logger := logger.With("url", r.URL.Path)
		prefix := fmt.Sprintf("/%s/files/", name)
		idx := strings.Index(r.URL.Path, prefix)
		if idx == -1 {
			logger.DebugContext(r.Context(), "failed to find a file path in the URL")
			responder.Error(apierrors.NewBadRequest("invalid request path"))
			return
		}

		filePath := r.URL.Path[idx+len(prefix):]
		if filePath == "" {
			logger.DebugContext(r.Context(), "got an empty file path")
			responder.Error(apierrors.NewBadRequest("missing path"))
			return
		}

		if strings.Contains(filePath, "..") {
			logger.DebugContext(r.Context(), "got a file path including '..'; failing the request for security reasons")
			responder.Error(apierrors.NewBadRequest("invalid path navigation"))
			return
		}

		switch filepath.Ext(filePath) {
		case ".json", ".yaml", ".yml":
			// ok
		default:
			logger.DebugContext(r.Context(), "got a file extension that was not JSON or YAML", "extension", filepath.Ext(filePath))
			responder.Error(apierrors.NewBadRequest("only yaml and json files supported"))
			return
		}

		var obj *provisioning.ResourceWrapper
		ref := r.URL.Query().Get("ref")
		message := r.URL.Query().Get("message")
		logger = logger.With("ref", ref, "message", message)

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

func (s *filesConnector) getParser(repo repository.Repository) (*fileParser, error) {
	ns := repo.Config().Namespace
	if ns == "" {
		return nil, fmt.Errorf("missing namespace")
	}
	client, err := s.client.Client(ns) // As system user
	if err != nil {
		return nil, err
	}
	return newFileParser(ns, repo, client, newKindsLookup(client)), nil
}

func (s *filesConnector) doRead(ctx context.Context, logger *slog.Logger, repo repository.Repository, path string, ref string) (int, *provisioning.ResourceWrapper, error) {
	info, err := repo.Read(ctx, logger, path, ref)
	if err != nil {
		return 0, nil, err
	}

	parser, err := s.getParser(repo)
	if err != nil {
		return 0, nil, err
	}

	parsed, err := parser.parse(ctx, logger, info, true)
	if err != nil {
		return 0, nil, err
	}

	// GVR will exist for anything we can actually save (dashboard/playlist for now)
	if parsed.gvr == nil {
		if parsed.gvk != nil {
			//nolint:govet
			parsed.errors = append(parsed.errors, fmt.Errorf("unknown resource for Kind: "+parsed.gvk.Kind))
		} else {
			parsed.errors = append(parsed.errors, fmt.Errorf("unknown resource"))
		}
	}

	code := http.StatusOK
	if len(parsed.errors) > 0 {
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

	parser, err := s.getParser(repo)
	if err != nil {
		return nil, err
	}

	parsed, err := parser.parse(ctx, logger, info, true)
	if err != nil {
		if errors.Is(err, ErrUnableToReadResourceBytes) {
			return nil, apierrors.NewBadRequest("unable to read the request as a resource")
		}
		return nil, err
	}

	// GVR will exist for anything we can actually save (dashboard/playlist for now)
	if parsed.gvr == nil {
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
	if parsed.existing == nil {
		obj, err := parsed.client.Create(ctx, parsed.obj, metav1.CreateOptions{})
		if err != nil {
			parsed.errors = append(parsed.errors, err)
		} else {
			parsed.obj = obj
		}
	} else {
		obj, err := parsed.client.Update(ctx, parsed.obj, metav1.UpdateOptions{})
		if err != nil {
			parsed.errors = append(parsed.errors, err)
		} else {
			parsed.obj = obj
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
