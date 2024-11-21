package provisioning

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

type filesConnector struct {
	getter RepoGetter
	client *resourceClient
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
	repo, err := s.getter.GetRepository(ctx, name)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefix := fmt.Sprintf("/%s/files/", name)
		idx := strings.Index(r.URL.Path, prefix)
		if idx == -1 {
			responder.Error(errors.NewBadRequest("invalid request path"))
			return
		}

		filePath := r.URL.Path[idx+len(prefix):]
		if filePath == "" {
			responder.Error(errors.NewBadRequest("missing path"))
			return
		}

		if strings.Contains(filePath, "..") {
			responder.Error(errors.NewBadRequest("invalid path navigation"))
			return
		}

		switch filepath.Ext(filePath) {
		case ".json", ".yaml", ".yml":
			// ok
		default:
			responder.Error(errors.NewBadRequest("only yaml and json files supported"))
			return
		}

		var obj runtime.Object
		ref := r.URL.Query().Get("ref")
		message := r.URL.Query().Get("message")

		code := http.StatusOK
		switch r.Method {
		case http.MethodGet:
			obj, err, code = s.doRead(r.Context(), repo, filePath, ref)
		case http.MethodPost:
			obj, err = s.doWrite(r.Context(), false, repo, filePath, ref, message, r)
		case http.MethodPut:
			obj, err = s.doWrite(r.Context(), true, repo, filePath, ref, message, r)
		case http.MethodDelete:
			obj, err = s.doDelete(r.Context(), repo, filePath, ref, message)
		default:
			err = errors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method)
		}

		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(code, obj)
	}), nil
}

func (s *filesConnector) getParser(repo Repository) (*fileParser, error) {
	ns := repo.Config().Namespace
	if ns == "" {
		return nil, fmt.Errorf("missing namespace")
	}
	client, err := s.client.Client(ns) // As system user
	if err != nil {
		return nil, err
	}
	return &fileParser{
		namespace: ns,
		repo:      repo,
		client:    client,
		kinds:     newKindsLookup(client),
	}, nil
}

func (s *filesConnector) doRead(ctx context.Context, repo Repository, path string, ref string) (*provisioning.ResourceWrapper, error, int) {
	info, err := repo.Read(ctx, path, ref)
	if err != nil {
		return nil, err, 0
	}

	parser, err := s.getParser(repo)
	if err != nil {
		return nil, err, 0
	}

	parsed, err := parser.parse(ctx, info, true)
	if err != nil {
		return nil, err, 0
	}

	code := http.StatusOK
	if len(parsed.errors) > 0 {
		code = http.StatusNotAcceptable
	}
	return parsed.AsResourceWrapper(), nil, code
}

func (s *filesConnector) doWrite(ctx context.Context, update bool, repo Repository, path string, ref string, message string, req *http.Request) (runtime.Object, error) {
	settings := repo.Config().Spec.Editing
	if update && !settings.Update {
		return nil, errors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), "updating files not enabled", nil)
	} else if !settings.Create {
		return nil, errors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), "creating files not enabled", nil)
	}

	defer req.Body.Close()
	data, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}

	info := &FileInfo{
		Data: data,
		Path: path,
		Ref:  ref,
	}

	parser, err := s.getParser(repo)
	if err != nil {
		return nil, err
	}

	parsed, err := parser.parse(ctx, info, true)
	if err != nil {
		return nil, err
	}

	data, err = parsed.ToSaveBytes()
	if err != nil {
		return nil, err
	}

	if update {
		err = repo.Update(ctx, path, data, message)
	} else {
		err = repo.Create(ctx, path, data, message)
	}
	if err != nil {
		return nil, err
	}

	fmt.Printf("TODO! write the file into real storage %s\n", path)

	return parsed.obj, err
}

func (s *filesConnector) doDelete(ctx context.Context, repo Repository, path string, ref string, message string) (runtime.Object, error) {
	settings := repo.Config().Spec.Editing
	if !settings.Delete {
		return nil, errors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), "deleting is not supported", nil)
	}

	err := repo.Delete(ctx, path, message)
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
