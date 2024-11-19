package provisioning

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/google/go-github/v66/github"
	"golang.org/x/oauth2"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

type githubRepository struct {
	config *provisioning.Repository
}

func newGithubRepository(config *provisioning.Repository) *githubRepository {
	return &githubRepository{config}
}

func (r *githubRepository) Config() *provisioning.Repository {
	return r.config
}

// Validate implements provisioning.Repository.
func (r *githubRepository) Validate() (list field.ErrorList) {
	gh := r.config.Spec.GitHub
	if gh == nil {
		list = append(list, field.Required(field.NewPath("spec", "github"), "a github config is required"))
		return list
	}
	if gh.Owner == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "owner"), "a github repo owner is required"))
	}
	if gh.Repository == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "repository"), "a github repo name is required"))
	}
	if gh.Token == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "token"), "a github access token is required"))
	}
	if gh.GenerateDashboardPreviews && !gh.BranchWorkflow {
		list = append(list, field.Forbidden(field.NewPath("spec", "github", "token"), "to generate dashboard previews, you must activate the branch workflow"))
	}
	return list
}

// Test implements provisioning.Repository.
func (r *githubRepository) Test(ctx context.Context) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "test is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// TODO: add validation in admission hook
// extractOwnerAndRepo takes a GitHub repository URL and returns the owner and repo name.
func extractOwnerAndRepo(repoURL string) (string, string, error) {
	parsedURL, err := url.Parse(repoURL)
	if err != nil {
		return "", "", fmt.Errorf("invalid URL: %w", err)
	}

	// Split the path to get owner and repo
	parts := strings.Split(strings.Trim(parsedURL.Path, "/"), "/")
	if len(parts) < 2 {
		return "", "", fmt.Errorf("URL does not contain owner and repo")
	}

	owner := parts[0]
	repo := parts[1]
	return owner, repo, nil
}

// ReadResource implements provisioning.Repository.
func (r *githubRepository) ReadResource(ctx context.Context, filePath string, commit string) (io.Reader, error) {
	tokenSrc := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: r.config.Spec.GitHub.Token},
	)
	tokenClient := oauth2.NewClient(ctx, tokenSrc)
	githubClient := github.NewClient(tokenClient)

	owner, repoName, err := extractOwnerAndRepo(r.config.Spec.GitHub.Repository)
	if err != nil {
		return nil, fmt.Errorf("failed to extract owner and repo: %w", err)
	}

	content, _, _, err := githubClient.Repositories.GetContents(ctx, owner, repoName, filePath, &github.RepositoryContentGetOptions{
		Ref: commit,
	})
	if err != nil {
		// TODO: return bad request status code
		return nil, fmt.Errorf("failed to get content: %w", err)
	}

	data, err := content.GetContent()
	if err != nil {
		return nil, err
	}
	return bytes.NewReader([]byte(data)), nil
}

// Webhook implements provisioning.Repository.
func (r *githubRepository) Webhook() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// really any handler
		// get the repository from the path
		_, _ = w.Write([]byte("TODO... handle github webhook " + r.URL.Path))
	}
}
