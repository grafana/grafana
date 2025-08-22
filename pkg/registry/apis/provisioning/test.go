package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type StatusPatcherProvider interface {
	GetStatusPatcher() *controller.RepositoryStatusPatcher
}

type HealthCheckerProvider interface {
	GetHealthChecker() *controller.HealthChecker
}

type testConnector struct {
	getter         RepoGetter
	tester         controller.RepositoryTester
	healthProvider HealthCheckerProvider
}

func NewTestConnector(getter RepoGetter, tester controller.RepositoryTester, healthProvider HealthCheckerProvider) *testConnector {
	return &testConnector{
		getter:         getter,
		tester:         tester,
		healthProvider: healthProvider,
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

		var rsp *provisioning.TestResults
		if repo == nil {
			healthChecker := s.healthProvider.GetHealthChecker()
			if healthChecker == nil {
				// Use precondition failed for when health checker is not ready yet
				responder.Error(&errors.StatusError{
					ErrStatus: metav1.Status{
						Status:  metav1.StatusFailure,
						Code:    http.StatusPreconditionFailed,
						Reason:  metav1.StatusReason("PreconditionFailed"),
						Message: "health checker not initialized yet, please try again",
					},
				})
				return
			}

			// Testing existing repository - get it and update health
			repo, err = s.getter.GetRepository(ctx, name)
			if err != nil {
				responder.Error(err)
				return
			}

			// If the last error was not a health check error or empty, return precondition failed
			health := repo.Config().Status.Health
			if health.Error != provisioning.HealthFailureHealth && health.Error != "" {
				rsp = &provisioning.TestResults{
					Success: false,
					Code:    http.StatusPreconditionFailed,
					Errors: func() []provisioning.ErrorDetails {
						var errs []provisioning.ErrorDetails
						for _, msg := range health.Message {
							errs = append(errs, provisioning.ErrorDetails{Detail: msg})
						}
						return errs
					}(),
				}

				if err := healthChecker.RefreshTimestamp(ctx, repo.Config()); err != nil {
					responder.Error(err)
					return
				}

				responder.Object(rsp.Code, rsp)
				return
			}

			rsp, _, err = healthChecker.RefreshHealth(ctx, repo)
			if err != nil {
				responder.Error(err)
				return
			}
		} else {
			// Testing temporary repository - just run test without status update
			rsp, err = s.tester.TestRepository(ctx, repo)
			if err != nil {
				responder.Error(err)
				return
			}
		}

		responder.Object(rsp.Code, rsp)
	}), 30*time.Second), nil
}

var (
	_ rest.Storage         = (*testConnector)(nil)
	_ rest.Connecter       = (*testConnector)(nil)
	_ rest.StorageMetadata = (*testConnector)(nil)
)
