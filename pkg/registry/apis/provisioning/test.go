package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type RepositoryTester interface {
	TestRepository(ctx context.Context, repo repository.Repository) (*provisioning.TestResults, error)
}

type testConnector struct {
	getter RepoGetter
	tester RepositoryTester
}

func NewTestConnector(getter RepoGetter, tester RepositoryTester) *testConnector {
	return &testConnector{
		getter: getter,
		tester: tester,
	}
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
	ns, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing namespace")
	}

	return WithTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := readBody(r, defaultMaxBodySize)
		if err != nil {
			responder.Error(err)
			return
		}
		var repo repository.Repository
		if len(body) > 0 {
			var cfg provisioning.Repository
			err = json.Unmarshal(body, &cfg)
			if err != nil {
				responder.Error(err)
				return
			}

			// In case the body is an empty object
			if !reflect.ValueOf(cfg).IsZero() {
				// HACK: Set the name and namespace if not set so that the temporary repository can be created
				// This can be removed once we deprecate legacy secrets is deprecated or we use InLineSecureValues as we
				// use the same field and repository name to detect which one to use.
				if cfg.GetName() == "" {
					if name == "new" {
						// HACK: frontend is passing a "new" we need to remove the hack there as well
						// Otherwise creation will fail as `new` is a reserved word. Not relevant here as we only "test"
						name = "hack-on-hack-for-new"
					}

					cfg.SetName(name)
				}

				if cfg.GetNamespace() == "" {
					cfg.SetNamespace(ns)
				}

				// Create a temporary repository
				tmp, err := s.getter.AsRepository(ctx, &cfg)
				if err != nil {
					responder.Error(err)
					return
				}
				repo = tmp
			}
		}

		if repo == nil {
			repo, err = s.getter.GetRepository(ctx, name)
			if err != nil {
				responder.Error(err)
				return
			}

			// TODO: in this case, we should update the health of the repository
		}

		// Only call test if field validation passes
		rsp, err := s.tester.TestRepository(ctx, repo)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(rsp.Code, rsp)
	}), 30*time.Second), nil
}

var (
	_ rest.Storage         = (*testConnector)(nil)
	_ rest.Connecter       = (*testConnector)(nil)
	_ rest.StorageMetadata = (*testConnector)(nil)
)
