package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"reflect"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
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
	return withTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
	repo.Status.Health = provisioning.HealthStatus{
		Healthy: res.Success,
		Checked: time.Now().UnixMilli(),
	}
	for _, err := range res.Errors {
		if err.Detail != "" {
			repo.Status.Health.Message = append(repo.Status.Health.Message, err.Detail)
		}
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
