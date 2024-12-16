package provisioning

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type testConnector struct {
	getter RepoGetter
	tester *RepositoryTester
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

		// Only call test if field validation passes
		rsp, err := s.tester.TestRepository(ctx, repo)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(rsp.Code, rsp)
	}), nil
}

type RepositoryTester struct {
	client *resources.ClientFactory
	logger *slog.Logger
}

// This function will check if the repository is configured and functioning as expected
func (t *RepositoryTester) TestRepository(ctx context.Context, repo repository.Repository) (*provisioning.TestResults, error) {
	errors := ValidateRepository(repo)
	if len(errors) > 0 {
		rsp := &provisioning.TestResults{
			Code:    http.StatusUnprocessableEntity, // Invalid
			Success: false,
			Errors:  make([]string, len(errors)),
		}
		for i, v := range errors {
			rsp.Errors[i] = v.Error()
		}
		return rsp, nil
	}

	// Check if the folder exists
	cfg := repo.Config()
	if cfg.Spec.Folder != "" {
		dynamicClient, _, err := t.client.New(cfg.Namespace)
		if err != nil {
			return nil, err
		}
		folderClient := dynamicClient.Resource(schema.GroupVersionResource{
			Group:    "folder.grafana.app",
			Version:  "v0alpha1",
			Resource: "folders",
		})
		_, err = folderClient.Get(ctx, cfg.Spec.Folder, metav1.GetOptions{})
		if !apierrors.IsNotFound(err) {
			return &provisioning.TestResults{
				Code:    http.StatusFailedDependency,
				Success: false,
				Errors:  []string{"Configured folder not found"},
			}, nil
		}
	}
	return repo.Test(ctx, t.logger)
}

// Validate a repository
func ValidateRepository(repo repository.Repository) field.ErrorList {
	list := repo.Validate()
	cfg := repo.Config()

	if cfg.Spec.Title == "" {
		list = append(list, field.Required(field.NewPath("spec", "title"), "a repository title must be given"))
	}

	// Reserved names (for now)
	reserved := []string{"classic", "sql", "SQL", "plugins", "legacy", "new", "job", "github", "s3", "gcs", "file", "new", "create", "update", "delete"}
	if slices.Contains(reserved, cfg.Name) {
		list = append(list, field.Invalid(field.NewPath("metadata", "name"), cfg.Name, "Name is reserved, choose a different identifier"))
	}

	if cfg.Spec.Type != provisioning.LocalRepositoryType && cfg.Spec.Local != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "local"),
			cfg.Spec.GitHub, "Local config only valid when type is local"))
	}

	if cfg.Spec.Type != provisioning.GitHubRepositoryType && cfg.Spec.GitHub != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "github"),
			cfg.Spec.GitHub, "Github config only valid when type is github"))
	}

	if cfg.Spec.Type != provisioning.S3RepositoryType && cfg.Spec.S3 != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "s3"),
			cfg.Spec.GitHub, "S3 config only valid when type is s3"))
	}
	return list
}

var (
	_ rest.Storage         = (*testConnector)(nil)
	_ rest.Connecter       = (*testConnector)(nil)
	_ rest.StorageMetadata = (*testConnector)(nil)
)
