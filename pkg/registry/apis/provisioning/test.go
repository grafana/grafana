package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"time"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
)

type StatusPatcherProvider interface {
	GetStatusPatcher() *appcontroller.RepositoryStatusPatcher
}

type HealthCheckerProvider interface {
	GetHealthChecker() *controller.RepositoryHealthChecker
}

type ConnectorDependencies interface {
	RepoGetter
	ConnectionGetter
	HealthCheckerProvider
	GetRepoFactory() repository.Factory
}

// testConnector handles the /test subresource for repositories.
// It allows users to validate repository configurations before creating or updating them.
//
// This connector uses a Tester configured with AdmissionValidator (via adapter) to perform
// the same validation that would occur during actual admission. This includes:
// - Basic configuration validation (RepositoryValidator)
// - Checking for conflicts with existing repositories (ExistingRepositoriesValidator)
//
// This is important because users can test new configurations before actually
// creating/updating them - we want to catch validation errors and conflicts during
// testing, not just during actual create/update operations.
// TODO: This connector is deprecated and will be removed when we deprecate the test endpoint
// We should use fieldErrors from status instead.
// TODO: Remove this connector when we deprecate the test endpoint
type testConnector struct {
	repoGetter       RepoGetter
	repoFactory      repository.Factory
	connectionGetter ConnectionGetter
	healthProvider   HealthCheckerProvider
	tester           repository.Tester
}

func NewTestConnector(
	deps ConnectorDependencies,
	tester repository.Tester,
) *testConnector {
	return &testConnector{
		repoFactory:      deps.GetRepoFactory(),
		repoGetter:       deps,
		connectionGetter: deps,
		healthProvider:   deps,
		tester:           tester,
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

func (s *testConnector) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
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
				if name == "new" {
					// HACK: frontend is passing a "new" we need to remove the hack there as well
					// Otherwise creation will fail as `new` is a reserved word. Not relevant here as we only "test"
					name = "hack-on-hack-for-new"
				} else {
					// Copy previous secure values if they exist
					// FIXME: I think this will need decryption on the old object secrets. That shouldn't be necessary as we only need the spec.
					old, _ := s.repoGetter.GetRepository(ctx, name)
					if old != nil {
						oldCfg := old.Config()
						repository.CopySecureValues(&cfg, oldCfg)

						// Copying previous finalizers
						if len(cfg.GetFinalizers()) == 0 {
							cfg.SetFinalizers(oldCfg.GetFinalizers())
						}
					}
				}

				cfg.SetName(name)
				if cfg.GetNamespace() == "" {
					cfg.SetNamespace(ns)
				}

				// In case the given repo has no finalizers, set the default ones.
				// This is because we now enforce their existence at validation time.
				if len(cfg.GetFinalizers()) == 0 {
					cfg.SetFinalizers([]string{
						repository.RemoveOrphanResourcesFinalizer,
						repository.CleanFinalizer,
					})
				}

				// In case a connection is specified, we should try creating a new token with given info
				// to check its validity
				if cfg.Spec.Connection != nil && cfg.Spec.Connection.Name != "" {
					// A connection must be there
					c, err := s.connectionGetter.GetConnection(ctx, cfg.Spec.Connection.Name)
					if err != nil {
						responder.Error(&k8serrors.StatusError{
							ErrStatus: metav1.Status{
								Status:  metav1.StatusFailure,
								Code:    http.StatusPreconditionFailed,
								Reason:  "PreconditionFailed",
								Message: fmt.Sprintf("connection '%s' not found", cfg.Spec.Connection.Name),
							},
						})
						return
					}

					token, err := c.GenerateRepositoryToken(ctx, &cfg)
					if err != nil {
						switch {
						case errors.Is(err, connection.ErrNotImplemented):
							responder.Error(&k8serrors.StatusError{
								ErrStatus: metav1.Status{
									Status:  metav1.StatusFailure,
									Code:    http.StatusNotImplemented,
									Reason:  "NotImplemented",
									Message: "token generation not implemented for given connection type",
								},
							})
						case errors.Is(err, connection.ErrRepositoryAccess):
							responder.Error(&k8serrors.StatusError{
								ErrStatus: metav1.Status{
									Status:  metav1.StatusFailure,
									Code:    http.StatusUnprocessableEntity,
									Reason:  "UnprocessableEntity",
									Message: err.Error(),
								},
							})
						case errors.Is(err, connection.ErrNotFound):
							responder.Error(&k8serrors.StatusError{
								ErrStatus: metav1.Status{
									Status:  metav1.StatusFailure,
									Code:    http.StatusNotFound,
									Reason:  metav1.StatusReasonNotFound,
									Message: err.Error(),
								},
							})
						case errors.Is(err, connection.ErrAuthentication):
							responder.Error(&k8serrors.StatusError{
								ErrStatus: metav1.Status{
									Status:  metav1.StatusFailure,
									Code:    http.StatusUnauthorized,
									Reason:  metav1.StatusReasonUnauthorized,
									Message: fmt.Sprintf("failed to generate repository token from connection: %v", err),
								},
							})
						default:
							responder.Error(&k8serrors.StatusError{
								ErrStatus: metav1.Status{
									Status:  metav1.StatusFailure,
									Code:    http.StatusInternalServerError,
									Reason:  metav1.StatusReasonInternalError,
									Message: fmt.Sprintf("failed to generate repository token from connection: %v", err),
								},
							})
						}
						return
					}

					cfg.Secure.Token.Create = token.Token
					// HACK: currently, Repository validator does not allow for Connection and token
					// to be declared together in a new / temporary Repository.
					// We are therefore removing it in such cases.
					cfg.Spec.Connection = nil
				}

				// Create a temporary repository
				tmp, err := s.repoFactory.Build(ctx, &cfg)
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
				responder.Error(&k8serrors.StatusError{
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
			repo, err = s.repoGetter.GetRepository(ctx, name)
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
						var errs []provisioning.ErrorDetails //nolint:prealloc
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
			rsp, err = s.tester.Test(ctx, repo)
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
