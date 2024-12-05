package provisioning

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type testConnector struct {
	getter RepoGetter
	logger *slog.Logger
}

func (*testConnector) New() runtime.Object {
	return &provisioning.TestResults{}
}

func (*testConnector) Destroy() {}

func (*testConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*testConnector) ProducesObject(verb string) any {
	return &provisioning.TestResults{}
}

func (*testConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*testConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (s *testConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	logger := s.logger.With("repository_name", name)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			responder.Error(err)
			return
		}
		var repo repository.Repository
		if len(body) > 0 {
			cfg := &provisioning.Repository{}
			err = json.Unmarshal(body, cfg)
			if err != nil {
				responder.Error(err)
				return
			}

			// Create a temporary repository
			tmp, err := s.getter.AsRepository(ctx, cfg)
			if err != nil {
				responder.Error(err)
				return
			}

			if name != "new" {
				repo, err = s.getter.AsRepository(ctx, cfg)
				if err != nil {
					responder.Error(err)
					return
				}

				// Make sure we are OK with the changes
				if cfg.Spec.Type != repo.Config().Spec.Type {
					responder.Error(apierrors.NewBadRequest("test config must be the same type"))
					return
				}
			}
			repo = tmp
		}

		if repo == nil {
			repo, err = s.getter.GetRepository(ctx, name)
			if err != nil {
				responder.Error(err)
				return
			}
		}

		rsp, err := repo.Test(ctx, logger)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(rsp.Code, rsp)
	}), nil
}

var (
	_ rest.Storage         = (*testConnector)(nil)
	_ rest.Connecter       = (*testConnector)(nil)
	_ rest.StorageMetadata = (*testConnector)(nil)
)
