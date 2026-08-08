package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type githubRepository struct {
	git.GitRepository
	config *provisioning.Repository
	gh     Client

	owner string
	repo  string
}

// GithubRepository is an interface that combines all repository capabilities
// needed for GitHub repositories.

//go:generate mockery --name GithubRepository --structname MockGithubRepository --inpackage --filename github_repository_mock.go --with-expecter
type GithubRepository interface {
	repository.Repository
	repository.Versioned
	repository.Writer
	repository.SizeLimitedReader
	repository.RepositoryWithURLs
	repository.StageableRepository
	repository.BranchHandler
	Owner() string
	Repo() string
	Client() Client
}

// NewRepository builds a github.com repository client.
func NewRepository(
	ctx context.Context,
	config *provisioning.Repository,
	gitRepo git.GitRepository,
	factory *Factory,
	token common.RawSecureValue,
) (GithubRepository, error) {
	return newRepository(ctx, config, gitRepo, factory, token, WithCustomServerURL(gitRepo.URL()))
}

func newRepository(
	ctx context.Context,
	config *provisioning.Repository,
	gitRepo git.GitRepository,
	factory *Factory,
	token common.RawSecureValue,
	opts ...ClientOption,
) (GithubRepository, error) {
	owner, repo, err := ParseOwnerRepoGithub(gitRepo.URL())
	if err != nil {
		return nil, fmt.Errorf("parse owner and repo: %w", err)
	}

	ghClient, err := factory.New(ctx, owner, repo, token, opts...)
	if err != nil {
		return nil, fmt.Errorf("create github client: %w", err)
	}

	return &githubRepository{
		config:        config,
		GitRepository: gitRepo,
		gh:            ghClient,
		owner:         owner,
		repo:          repo,
	}, nil
}

func (r *githubRepository) Owner() string {
	return r.owner
}

func (r *githubRepository) Repo() string {
	return r.repo
}

func (r *githubRepository) Client() Client {
	return r.gh
}

// ValidatePermissions implements repository.Repository.
// TODO: perform a real GitHub App scope check (contents/metadata/pull_requests/
// webhooks). The repository's own client cannot yet read installation
// permissions, so this scaffolding reports no missing permissions and does not
// block sync; the check will be filled in once that plumbing exists.
func (r *githubRepository) ValidatePermissions(ctx context.Context) ([]repository.Permission, error) {
	return nil, nil
}

func (r *githubRepository) GetDefaultBranch(ctx context.Context) (string, error) {
	repo, err := r.gh.GetRepository(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get repository metadata: %w", err)
	}
	return repo.DefaultBranch, nil
}

func (r *githubRepository) GetCurrentBranch() string {
	return r.config.Branch()
}

func (r *githubRepository) SetBranch(branch string) {
	r.config.SetBranch(branch)
	r.GitRepository.SetBranch(branch)
}

func ParseOwnerRepoGithub(giturl string) (owner string, repo string, err error) {
	giturl = strings.TrimSuffix(giturl, ".git")
	giturl = strings.TrimSuffix(giturl, "/")

	parsed, e := url.Parse(giturl)
	if e != nil {
		err = e
		return
	}
	parts := strings.Split(parsed.Path, "/")
	if len(parts) < 3 {
		err = fmt.Errorf("unable to parse repo+owner from url")
		return
	}
	return parts[1], parts[2], nil
}

// Test implements provisioning.Repository.
func (r *githubRepository) Test(ctx context.Context) (*provisioning.TestResults, error) {
	url := r.config.URL()
	_, _, err := ParseOwnerRepoGithub(url)
	if err != nil {
		return repository.FromFieldError(field.Invalid(
			field.NewPath("spec", r.config.Spec.Type.String(), "url"), url, err.Error())), nil
	}

	// For Github repositories, in case the branch is empty, we get the default branch and set it up for testing.
	if r.GetCurrentBranch() == "" {
		branch, err := r.GetDefaultBranch(ctx)
		if err != nil {
			return r.testResultFromGetDefaultBranchError(err), nil
		}

		r.SetBranch(branch)
	}

	results, err := r.GitRepository.Test(ctx)
	if err != nil || !results.Success {
		return results, err
	}

	if result := r.checkBranchProtection(ctx); result != nil {
		return result, nil
	}

	return results, nil
}

// testResultFromGetDefaultBranchError converts a GetDefaultBranch failure into a
// user-facing TestResults. The /test endpoint is the onboarding entry point; surfacing
// these as bare Go errors turns recoverable conditions (wrong URL, missing token scope,
// transient GitHub outage) into opaque HTTP 500s.
func (r *githubRepository) testResultFromGetDefaultBranchError(err error) *provisioning.TestResults {
	url := r.config.URL()
	path := field.NewPath("spec", r.config.Spec.Type.String(), "url")
	code := http.StatusBadRequest
	var detail string

	switch {
	case errors.Is(err, repository.ErrFileNotFound):
		detail = fmt.Sprintf("repository %q not found, or the configured token does not have access to it", url)
	case errors.Is(err, repository.ErrUnauthorized):
		path = field.NewPath("spec", r.config.Spec.Type.String(), "token")
		code = http.StatusUnauthorized
		detail = "authentication failed: the configured token is invalid or expired"
	case errors.Is(err, repository.ErrPermissionDenied):
		path = field.NewPath("spec", r.config.Spec.Type.String(), "token")
		code = http.StatusForbidden
		detail = fmt.Sprintf("the configured token lacks permission to access %q", url)
	case errors.Is(err, repository.ErrServerUnavailable):
		code = http.StatusServiceUnavailable
		detail = "GitHub is currently unavailable, please try again later"
	default:
		detail = err.Error()
	}

	return &provisioning.TestResults{
		Code:    code,
		Success: false,
		Errors: []provisioning.ErrorDetails{{
			Type:   metav1.CauseTypeFieldValueInvalid,
			Field:  path.String(),
			Detail: detail,
		}},
	}
}

// checkBranchProtection validates that branch protection rules and repository rulesets
// do not block direct pushes when the write workflow is configured.
// Returns nil if the check passes or is not applicable.
func (r *githubRepository) checkBranchProtection(ctx context.Context) *provisioning.TestResults {
	if !r.hasWriteWorkflow() {
		return nil
	}

	var allReasons []string

	// Check classic branch protection rules
	bp, err := r.gh.GetBranchProtection(ctx, r.GetCurrentBranch())
	if err != nil {
		// Failed to check branch protection - return error to user
		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  field.NewPath("spec", r.config.Spec.Type.String(), "branch").String(),
				Detail: fmt.Sprintf("failed to check branch protection for branch %q: %v", r.GetCurrentBranch(), err),
			}},
		}
	}

	if bp != nil {
		if reasons := bp.BlocksDirectPush(); len(reasons) > 0 {
			allReasons = append(allReasons, reasons...)
		}
	}

	// Check repository rulesets
	rulesets, err := r.gh.GetRulesets(ctx, r.GetCurrentBranch())
	if err != nil {
		// Failed to check rulesets - return error to user
		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  field.NewPath("spec", r.config.Spec.Type.String(), "branch").String(),
				Detail: fmt.Sprintf("failed to check repository rulesets for branch %q: %v", r.GetCurrentBranch(), err),
			}},
		}
	}

	if rulesets != nil {
		if reasons := rulesets.BlocksDirectPush(); len(reasons) > 0 {
			allReasons = append(allReasons, reasons...)
		}
	}

	// If any blocking rules were found, return error
	if len(allReasons) > 0 {
		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  field.NewPath("spec", "workflows").String(),
				Detail: fmt.Sprintf("branch %q has protection rules that prevent direct pushes: %s; the \"write\" workflow is not compatible with this branch", r.GetCurrentBranch(), strings.Join(allReasons, ", ")),
			}},
		}
	}

	return nil
}

func (r *githubRepository) hasWriteWorkflow() bool {
	for _, w := range r.config.Spec.Workflows {
		if w == provisioning.WriteWorkflow {
			return true
		}
	}
	return false
}

func (r *githubRepository) History(ctx context.Context, path, ref string) ([]provisioning.HistoryItem, error) {
	if ref == "" {
		ref = r.config.Branch()
	}

	finalPath := safepath.Join(r.config.Path(), path)
	commits, err := r.gh.Commits(ctx, finalPath, ref)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) {
			return nil, repository.ErrFileNotFound
		}

		return nil, fmt.Errorf("get commits: %w", err)
	}

	ret := make([]provisioning.HistoryItem, 0, len(commits))
	for _, commit := range commits {
		authors := make([]provisioning.Author, 0)
		if commit.Author != nil {
			authors = append(authors, provisioning.Author{
				Name:      commit.Author.Name,
				Username:  commit.Author.Username,
				AvatarURL: commit.Author.AvatarURL,
			})
		}

		if commit.Committer != nil && commit.Author != nil && commit.Author.Name != commit.Committer.Name {
			authors = append(authors, provisioning.Author{
				Name:      commit.Committer.Name,
				Username:  commit.Committer.Username,
				AvatarURL: commit.Committer.AvatarURL,
			})
		}

		ret = append(ret, provisioning.HistoryItem{
			Ref:       commit.Ref,
			Message:   commit.Message,
			Authors:   authors,
			CreatedAt: commit.CreatedAt.UnixMilli(),
		})
	}

	return ret, nil
}

// ListRefs list refs from the git repository and add the ref URL to the ref item
func (r *githubRepository) ListRefs(ctx context.Context) ([]provisioning.RefItem, error) {
	refs, err := r.GitRepository.ListRefs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list refs: %w", err)
	}

	for i := range refs {
		refs[i].RefURL = fmt.Sprintf("%s/tree/%s", r.config.URL(), refs[i].Name)
	}

	return refs, nil
}

// ResourceURLs implements RepositoryWithURLs.
// encodeGitPath percent-encodes each segment of a slash-separated repository
// path so characters that are valid in git paths but reserved in URLs (#, ?, %,
// spaces, …) don't corrupt the resulting blob link.
func encodeGitPath(p string) string {
	segments := strings.Split(p, "/")
	for i, s := range segments {
		segments[i] = url.PathEscape(s)
	}
	return strings.Join(segments, "/")
}

func (r *githubRepository) ResourceURLs(ctx context.Context, file *repository.FileInfo) (*provisioning.RepositoryURLs, error) {
	url := r.config.URL()
	branch := r.config.Branch()
	if file.Path == "" || url == "" {
		return nil, nil
	}

	ref := file.Ref
	if ref == "" {
		ref = branch
	}

	// file.Path is relative to the configured repository path (Read joins that
	// prefix before fetching), so re-apply it here or scoped repos get 404 links.
	// Use the provider-agnostic Path() so this is nil-safe for GitHub Enterprise
	// (Spec.GitHub is nil there).
	repoPath := safepath.Join(r.config.Path(), file.Path)

	urls := &provisioning.RepositoryURLs{
		RepositoryURL: r.config.URL(),
		SourceURL:     fmt.Sprintf("%s/blob/%s/%s", url, ref, encodeGitPath(repoPath)),
	}

	if ref != branch {
		urls.CompareURL = fmt.Sprintf("%s/compare/%s...%s", url, branch, ref)

		// Create a new pull request
		urls.NewPullRequestURL = fmt.Sprintf("%s?quick_pull=1&labels=grafana", urls.CompareURL)
	}

	return urls, nil
}

// RefURLs implements RepositoryWithURLs.
func (r *githubRepository) RefURLs(ctx context.Context, ref string) (*provisioning.RepositoryURLs, error) {
	url := r.config.URL()
	branch := r.config.Branch()
	if url == "" || ref == "" {
		return nil, nil
	}

	urls := &provisioning.RepositoryURLs{
		SourceURL: fmt.Sprintf("%s/tree/%s", url, ref),
	}

	if ref != branch {
		urls.CompareURL = fmt.Sprintf("%s/compare/%s...%s", url, branch, ref)
		urls.NewPullRequestURL = fmt.Sprintf("%s?quick_pull=1&labels=grafana", urls.CompareURL)
	}

	return urls, nil
}

var _ (GithubRepository) = (*githubRepository)(nil)
