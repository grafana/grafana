package provisioning

import (
	"context"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type prsConnector struct {
	getter RepoGetter
}

func NewPRsConnector(getter RepoGetter) *prsConnector {
	return &prsConnector{getter: getter}
}

func (*prsConnector) New() runtime.Object {
	return &provisioning.CreatePRResponse{}
}

func (*prsConnector) Destroy() {}

func (*prsConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*prsConnector) ProducesObject(verb string) any {
	return &provisioning.CreatePRResponse{}
}

func (*prsConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*prsConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *prsConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	logger := logging.FromContext(ctx).With("logger", "submit-connector", "repository_name", name)
	ctx = logging.Context(ctx, logger)
	repo, err := c.getter.GetHealthyRepository(ctx, name)
	if err != nil {
		logger.Debug("failed to find repository", "error", err)
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			responder.Error(apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method))
			return
		}

		query := r.URL.Query()
		ref := query.Get("ref")
		title := query.Get("title")
		content := query.Get("content")

		if ref == "" {
			responder.Error(apierrors.NewBadRequest("ref parameter is required"))
			return
		}

		if title == "" {
			responder.Error(apierrors.NewBadRequest("title parameter is required"))
			return
		}

		result, err := c.createPullRequest(ctx, repo, ref, title, content)
		if err != nil {
			responder.Error(err)
			return
		}

		responder.Object(http.StatusCreated, result)
	}), nil
}

func (c *prsConnector) createPullRequest(ctx context.Context, repo repository.Repository, ref, title, content string) (*provisioning.CreatePRResponse, error) {
	// Handle different repository types
	switch typedRepo := repo.(type) {
	case repository.GithubRepository:
		owner := typedRepo.Owner()
		repoName := typedRepo.Repo()
		client := typedRepo.Client()

		// Default base branch to the repository's configured branch
		baseBranch := repo.Config().Spec.GitHub.Branch

		// Create the pull request
		pr, err := client.CreatePullRequest(ctx, owner, repoName, title, content, ref, baseBranch)
		if err != nil {
			return nil, fmt.Errorf("failed to create pull request: %w", err)
		}

		return &provisioning.CreatePRResponse{
			Success: true,
			PullRequest: &provisioning.PullRequestInfo{
				Number: pr.Number,
				Title:  pr.Title,
				URL:    pr.HTMLURL,
				Head:   pr.Head,
				Base:   pr.Base,
			},
		}, nil

	default:
		// For other repository types, we could potentially add support later
		return nil, apierrors.NewBadRequest("creating pull requests is not supported for this repository type")
	}
}

var (
	_ rest.Storage         = (*prsConnector)(nil)
	_ rest.Connecter       = (*prsConnector)(nil)
	_ rest.StorageMetadata = (*prsConnector)(nil)
)
