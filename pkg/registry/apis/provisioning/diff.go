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

type diffConnector struct {
	getter RepoGetter
}

func NewDiffConnector(getter RepoGetter) *diffConnector {
	return &diffConnector{getter: getter}
}

func (*diffConnector) New() runtime.Object {
	return &provisioning.RefDiffResponse{}
}

func (*diffConnector) Destroy() {}

func (*diffConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*diffConnector) ProducesObject(verb string) any {
	return &provisioning.RefDiffResponse{}
}

func (*diffConnector) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (*diffConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *diffConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	logger := logging.FromContext(ctx).With("logger", "diff-connector", "repository_name", name)
	ctx = logging.Context(ctx, logger)
	repo, err := c.getter.GetHealthyRepository(ctx, name)
	if err != nil {
		logger.Debug("failed to find repository", "error", err)
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			responder.Error(apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method))
			return
		}

		query := r.URL.Query()
		head := query.Get("ref")
		base := query.Get("base")

		if head == "" {
			responder.Error(apierrors.NewBadRequest("ref parameter is required"))
			return
		}

		result, err := c.getDiff(ctx, repo, base, head)
		if err != nil {
			responder.Error(err)
			return
		}

		responder.Object(http.StatusOK, result)
	}), nil
}

func (c *diffConnector) getDiff(ctx context.Context, repo repository.Repository, base, head string) (*provisioning.RefDiffResponse, error) {
	// Handle different repository types
	switch typedRepo := repo.(type) {
	case repository.GithubRepository:
		owner := typedRepo.Owner()
		repoName := typedRepo.Repo()

		// Use default base branch if not specified
		if base == "" {
			base = repo.Config().Spec.GitHub.Branch
		}

		// Get the diff
		diff, err := typedRepo.GetDiff(ctx, base, head)
		if err != nil {
			return nil, fmt.Errorf("failed to get diff: %w", err)
		}

		// Get commits between refs
		commits, err := typedRepo.GetCommitsBetweenRefs(ctx, base, head)
		if err != nil {
			return nil, fmt.Errorf("failed to get commits: %w", err)
		}

		// Convert commits to our response format
		commitInfos := make([]provisioning.CommitInfo, len(commits))
		for i, commit := range commits {
			commitInfos[i] = provisioning.CommitInfo{
				SHA:       commit.SHA,
				Message:   commit.Message,
				Author:    commit.Author,
				Timestamp: commit.Timestamp,
				CommitURL: fmt.Sprintf("https://github.com/%s/%s/commit/%s", owner, repoName, commit.SHA),
			}
		}

		// Convert to our response format
		files := make([]provisioning.FileChange, len(diff.Files))

		for i, file := range diff.Files {
			fileChange := provisioning.FileChange{
				Path:   file.Filename,
				Status: file.Status,
				Patch:  file.Patch,
			}

			if file.PreviousName != "" {
				fileChange.PreviousPath = file.PreviousName
			}

			// Generate GitHub file diff URL
			fileChange.FileURL = fmt.Sprintf("https://github.com/%s/%s/commit/%s#diff-%s",
				owner, repoName, head, file.Filename)

			files[i] = fileChange
		}

		// Generate GitHub compare URL
		diffURL := fmt.Sprintf("https://github.com/%s/%s/compare/%s...%s",
			owner, repoName, base, head)

		return &provisioning.RefDiffResponse{
			Diff: &provisioning.DiffInfo{
				Head:    head,
				Base:    base,
				Files:   files,
				Commits: commitInfos,
				DiffURL: diffURL,
			},
		}, nil

	default:
		// For other repository types, we could potentially add support later
		return nil, apierrors.NewBadRequest("getting diff is not supported for this repository type")
	}
}

var (
	_ rest.Storage         = (*diffConnector)(nil)
	_ rest.Connecter       = (*diffConnector)(nil)
	_ rest.StorageMetadata = (*diffConnector)(nil)
)
