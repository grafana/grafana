package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type testConnector struct {
	getter RepoGetter
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
		}

		// Only call test if field validation passes
		rsp, err := repository.TestRepository(ctx, repo)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(rsp.Code, rsp)
	}), 30*time.Second), nil
}

// TODO: Move tester to a more suitable location out of the connector.
type RepositoryTester struct {
	// Repository+Jobs
	client client.ProvisioningV0alpha1Interface
}

// This function will check if the repository is configured and functioning as expected
func (t *RepositoryTester) UpdateHealthStatus(ctx context.Context, cfg *provisioning.Repository, res *provisioning.TestResults) (*provisioning.Repository, error) {
	if res == nil {
		res = &provisioning.TestResults{
			Success: false,
			Errors: []provisioning.ErrorDetails{{
				Detail: "missing health status",
			}},
		}
	}

	repo := cfg.DeepCopy()

	// Preserve existing hook failure messages
	const hookFailureMessage = "Hook execution failed"
	var preservedMessages []string
	for _, msg := range cfg.Status.Health.Message {
		if len(msg) >= len(hookFailureMessage) && msg[:len(hookFailureMessage)] == hookFailureMessage {
			preservedMessages = append(preservedMessages, msg)
		}
	}

	repo.Status.Health = provisioning.HealthStatus{
		Healthy: res.Success,
		Checked: time.Now().UnixMilli(),
		Message: preservedMessages, // Start with preserved hook failure messages
	}

	// Add test result errors
	for _, err := range res.Errors {
		if err.Detail != "" {
			repo.Status.Health.Message = append(repo.Status.Health.Message, err.Detail)
		}
	}

	// If we have hook failures, the repository should be considered unhealthy regardless of test results
	if len(preservedMessages) > 0 {
		repo.Status.Health.Healthy = false
	}

	_, err := t.client.Repositories(repo.GetNamespace()).
		UpdateStatus(ctx, repo, metav1.UpdateOptions{})
	return repo, err
}

var (
	_ rest.Storage         = (*testConnector)(nil)
	_ rest.Connecter       = (*testConnector)(nil)
	_ rest.StorageMetadata = (*testConnector)(nil)
)
