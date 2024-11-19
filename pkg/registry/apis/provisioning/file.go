package provisioning

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer/yaml"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

type readConnector struct {
	getter RepoGetter
}

func (*readConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &provisioning.ResourceWrapper{}
}

func (*readConnector) Destroy() {}

func (*readConnector) NamespaceScoped() bool {
	return true
}

func (*readConnector) GetSingularName() string {
	return "Resource"
}

func (*readConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*readConnector) ProducesObject(verb string) any {
	return &provisioning.ResourceWrapper{}
}

func (*readConnector) ConnectMethods() []string {
	return []string{http.MethodGet, http.MethodPut, http.MethodPost, http.MethodDelete}
}

func (*readConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, "" // true adds the {path} component
}

func (s *readConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	repo, err := s.getter.GetRepository(ctx, name)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		idx := strings.Index(r.URL.Path, "/"+name+"/read")
		filePath := strings.TrimLeft(r.URL.Path[idx+len(name+"/read")+1:], "/")
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
		commit := r.URL.Query().Get("commit")
		message := r.URL.Query().Get("message")

		switch r.Method {
		case http.MethodGet:
			obj, err = s.doRead(r.Context(), repo, filePath, commit)
		case http.MethodPost:
			obj, err = s.doWrite(r.Context(), true, repo, filePath, message, r)
		case http.MethodPut:
			obj, err = s.doWrite(r.Context(), false, repo, filePath, message, r)
		case http.MethodDelete:
			obj, err = s.doDelete(r.Context(), repo, filePath, message)
		default:
			err = errors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method)
		}

		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(200, obj)
	}), nil
}

func (s *readConnector) getValidatedBody(_ context.Context, data []byte) (*unstructured.Unstructured, *schema.GroupVersionKind, error) {
	obj, gvk, err := LoadYAMLOrJSON(bytes.NewBuffer(data))
	if err != nil {
		obj, gvk, err = FallbackResourceLoader(data)
		if err != nil {
			return nil, nil, err
		}
	}

	// TODO? dry run??? and add validation errors/warnings?
	fmt.Printf("TODO, get client and then dry run... %+v\n", gvk)

	return obj, gvk, err
}

func (s *readConnector) doRead(ctx context.Context, repo Repository, path string, commit string) (*provisioning.ResourceWrapper, error) {
	data, err := repo.Read(ctx, path, commit)
	if err != nil {
		return nil, err
	}

	obj, _, err := s.getValidatedBody(ctx, data)
	if err != nil {
		return nil, err
	}

	return &provisioning.ResourceWrapper{
		Path:   path,
		Commit: commit,
		Resource: v0alpha1.Unstructured{
			Object: obj.Object,
		},
	}, nil
}

func (s *readConnector) doWrite(ctx context.Context, update bool, repo Repository, path string, message string, req *http.Request) (runtime.Object, error) {
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

	obj, _, err := s.getValidatedBody(ctx, data)
	if err != nil {
		return nil, err
	}

	switch filepath.Ext(path) {
	// JSON pretty print
	case ".json":
		data, err = json.MarshalIndent(obj, "", "  ")
		if err != nil {
			return nil, err
		}

	// Write the value as yaml
	case ".yaml", ".yml":
		buff := bytes.NewBuffer(make([]byte, 0, 1024))
		err = yaml.NewDecodingSerializer(unstructured.UnstructuredJSONScheme).
			Encode(obj, buff)
		if err != nil {
			return nil, err
		}
		data = buff.Bytes()

	default:
		return nil, fmt.Errorf("unexpected format")
	}

	if update {
		err = repo.Update(ctx, path, data, message)
	} else {
		err = repo.Create(ctx, path, data, message)
	}
	if err != nil {
		return nil, err
	}

	fmt.Printf("TODO! trigger sync for this file we just wrote... %s\n", path)

	return obj, err
}

func (s *readConnector) doDelete(ctx context.Context, repo Repository, path string, message string) (runtime.Object, error) {
	settings := repo.Config().Spec.Editing
	if !settings.Delete {
		return nil, errors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), "deleting is not supported", nil)
	}

	err := repo.Delete(ctx, path, message)
	if err != nil {
		return nil, err
	}

	fmt.Printf("TODO! trigger sync for this file we just deleted... %s\n", path)

	return nil, err
}

var (
	_ rest.Storage              = (*readConnector)(nil)
	_ rest.Connecter            = (*readConnector)(nil)
	_ rest.Scoper               = (*readConnector)(nil)
	_ rest.SingularNameProvider = (*readConnector)(nil)
	_ rest.StorageMetadata      = (*readConnector)(nil)
)
