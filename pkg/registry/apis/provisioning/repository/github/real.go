package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/go-github/v66/github"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type realImpl struct {
	gh *github.Client
}

var _ Client = (*realImpl)(nil)

func NewRealClient(client *github.Client) *realImpl {
	return &realImpl{client}
}

func (r *realImpl) IsAuthenticated(ctx context.Context) error {
	if _, _, err := r.gh.Users.Get(ctx, ""); err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) {
			switch ghErr.Response.StatusCode {
			case http.StatusUnauthorized:
				return apierrors.NewUnauthorized("token is invalid or expired")
			case http.StatusForbidden:
				return &apierrors.StatusError{
					ErrStatus: metav1.Status{
						Status:  metav1.StatusFailure,
						Code:    http.StatusUnauthorized,
						Reason:  metav1.StatusReasonUnauthorized,
						Message: "token is revoked or has insufficient permissions",
					},
				}
			case http.StatusServiceUnavailable:
				return ErrServiceUnavailable
			}
		}

		return err
	}

	return nil
}

func (r *realImpl) RepoExists(ctx context.Context, owner, repository string) (bool, error) {
	_, resp, err := r.gh.Repositories.Get(ctx, owner, repository)
	if err == nil {
		return true, nil
	}
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}

	return false, err
}

func (r *realImpl) GetContents(ctx context.Context, owner, repository, path, ref string) (fileContents RepositoryContent, dirContents []RepositoryContent, err error) {
	if strings.Contains(path, "..") {
		return nil, nil, ErrPathTraversalDisallowed
	}

	fc, dc, _, err := r.gh.Repositories.GetContents(ctx, owner, repository, path, &github.RepositoryContentGetOptions{
		Ref: ref,
	})
	if err != nil {
		var ghErr *github.ErrorResponse
		if !errors.As(err, &ghErr) {
			return nil, nil, err
		}
		if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return nil, nil, ErrServiceUnavailable
		}
		if ghErr.Response.StatusCode == http.StatusNotFound {
			return nil, nil, ErrResourceNotFound
		}
		return nil, nil, err
	} else if fc != nil {
		return realRepositoryContent{fc}, nil, nil
	} else {
		converted := make([]RepositoryContent, 0, len(dc))
		for _, original := range dc {
			converted = append(converted, realRepositoryContent{original})
		}
		return nil, converted, nil
	}
}

func (r *realImpl) GetTree(ctx context.Context, owner, repository, ref string, recursive bool) ([]RepositoryContent, bool, error) {
	tree, _, err := r.gh.Git.GetTree(ctx, owner, repository, ref, recursive)
	if err != nil {
		var ghErr *github.ErrorResponse
		if !errors.As(err, &ghErr) {
			return nil, false, err
		}
		if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return nil, false, ErrServiceUnavailable
		}
		if ghErr.Response.StatusCode == http.StatusNotFound {
			return nil, false, ErrResourceNotFound
		}
		return nil, false, err
	}

	entries := make([]RepositoryContent, 0, len(tree.Entries))
	for _, te := range tree.Entries {
		rrc := &realRepositoryContent{
			real: &github.RepositoryContent{
				Path: te.Path,
				Size: te.Size,
				SHA:  te.SHA,
			},
		}
		if te.GetType() == "tree" {
			rrc.real.Type = github.String("dir")
		} else {
			rrc.real.Type = te.Type
		}
		entries = append(entries, rrc)
	}
	return entries, tree.GetTruncated(), nil
}

func (r *realImpl) CreateFile(ctx context.Context, owner, repository, path, branch, message string, content []byte) error {
	if strings.Contains(path, "..") {
		return ErrPathTraversalDisallowed
	}

	if message == "" {
		message = fmt.Sprintf("Create %s", path)
	}

	_, _, err := r.gh.Repositories.CreateFile(ctx, owner, repository, path, &github.RepositoryContentFileOptions{
		Branch:  &branch,
		Message: &message,
		Content: content,
	})
	if err == nil {
		return nil
	}

	var ghErr *github.ErrorResponse
	if !errors.As(err, &ghErr) {
		return err
	}
	if ghErr.Response.StatusCode == http.StatusUnprocessableEntity {
		return ErrResourceAlreadyExists
	}
	return err
}

func (r *realImpl) UpdateFile(ctx context.Context, owner, repository, path, branch, message, hash string, content []byte) error {
	if strings.Contains(path, "..") {
		return ErrPathTraversalDisallowed
	}

	if message == "" {
		message = fmt.Sprintf("Update %s", path)
	}

	_, _, err := r.gh.Repositories.UpdateFile(ctx, owner, repository, path, &github.RepositoryContentFileOptions{
		Branch:  &branch,
		Message: &message,
		Content: content,
		SHA:     &hash,
	})
	if err == nil {
		return nil
	}

	var ghErr *github.ErrorResponse
	if !errors.As(err, &ghErr) {
		return err
	}
	if ghErr.Response.StatusCode == http.StatusNotFound {
		return ErrResourceNotFound
	}
	if ghErr.Response.StatusCode == http.StatusConflict {
		return ErrMismatchedHash
	}
	if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
		return ErrServiceUnavailable
	}
	return err
}

func (r *realImpl) DeleteFile(ctx context.Context, owner, repository, path, branch, message, hash string) error {
	if strings.Contains(path, "..") {
		return ErrPathTraversalDisallowed
	}

	if message == "" {
		message = fmt.Sprintf("Delete %s", path)
	}

	_, _, err := r.gh.Repositories.DeleteFile(ctx, owner, repository, path, &github.RepositoryContentFileOptions{
		Branch:  &branch,
		Message: &message,
		SHA:     &hash,
	})
	if err == nil {
		return nil
	}

	var ghErr *github.ErrorResponse
	if !errors.As(err, &ghErr) {
		return err
	}
	if ghErr.Response.StatusCode == http.StatusNotFound {
		return ErrResourceNotFound
	}
	if ghErr.Response.StatusCode == http.StatusConflict {
		return ErrMismatchedHash
	}
	if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
		return ErrServiceUnavailable
	}
	return err
}

func (r *realImpl) Commits(ctx context.Context, owner, repository, path, branch string) ([]Commit, error) {
	commits, _, err := r.gh.Repositories.ListCommits(ctx, owner, repository, &github.CommitsListOptions{
		Path: path,
		SHA:  branch,
	})
	if err != nil {
		var ghErr *github.ErrorResponse
		if !errors.As(err, &ghErr) {
			return nil, err
		}
		if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return nil, ErrServiceUnavailable
		}

		if ghErr.Response.StatusCode == http.StatusNotFound {
			return nil, ErrResourceNotFound
		}

		return nil, err
	}

	ret := make([]Commit, 0, len(commits))
	for _, c := range commits {
		var createdAt time.Time
		var author *CommitAuthor
		if c.GetCommit().GetAuthor() != nil {
			author = &CommitAuthor{
				Name:      c.GetCommit().GetAuthor().GetName(),
				Username:  c.GetAuthor().GetLogin(),
				AvatarURL: c.GetAuthor().GetAvatarURL(),
			}

			createdAt = c.GetCommit().GetAuthor().GetDate().Time
		}

		var committer *CommitAuthor
		if c.GetCommitter() != nil {
			committer = &CommitAuthor{
				Name:      c.GetCommit().GetCommitter().GetName(),
				Username:  c.GetCommitter().GetLogin(),
				AvatarURL: c.GetCommitter().GetAvatarURL(),
			}
		}

		ret = append(ret, Commit{
			Ref:       c.GetSHA(),
			Message:   c.GetCommit().GetMessage(),
			Author:    author,
			Committer: committer,
			CreatedAt: createdAt,
		})
	}

	return ret, nil
}

func (r *realImpl) CreateBranch(ctx context.Context, owner, repository, sourceBranch, branchName string) error {
	// Fail if the branch already exists
	if _, _, err := r.gh.Repositories.GetBranch(ctx, owner, repository, branchName, 0); err == nil {
		return ErrResourceAlreadyExists
	}

	// Branch out based on the repository branch
	baseRef, _, err := r.gh.Repositories.GetBranch(ctx, owner, repository, sourceBranch, 0)
	if err != nil {
		return fmt.Errorf("get base branch: %w", err)
	}

	if _, _, err := r.gh.Git.CreateRef(ctx, owner, repository, &github.Reference{
		Ref: github.String(fmt.Sprintf("refs/heads/%s", branchName)),
		Object: &github.GitObject{
			SHA: baseRef.Commit.SHA,
		},
	}); err != nil {
		return fmt.Errorf("create branch ref: %w", err)
	}

	return nil
}

func (r *realImpl) BranchExists(ctx context.Context, owner, repository, branchName string) (bool, error) {
	_, resp, err := r.gh.Repositories.GetBranch(ctx, owner, repository, branchName, 0)
	if err == nil {
		return true, nil
	}

	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}

	return false, err
}

func (r *realImpl) ListWebhooks(ctx context.Context, owner, repository string) ([]WebhookConfig, error) {
	hooks, _, err := r.gh.Repositories.ListHooks(ctx, owner, repository, nil)
	if err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return nil, ErrServiceUnavailable
		}
		return nil, err
	}

	ret := make([]WebhookConfig, 0, len(hooks))
	for _, h := range hooks {
		contentType := h.GetConfig().GetContentType()
		if contentType == "" {
			contentType = "form"
		}

		ret = append(ret, WebhookConfig{
			ID:          h.GetID(),
			Events:      h.Events,
			Active:      h.GetActive(),
			URL:         h.GetConfig().GetURL(),
			ContentType: contentType,
			// Intentionally not setting Secret.
		})
	}
	return ret, nil
}

func (r *realImpl) CreateWebhook(ctx context.Context, owner, repository string, cfg WebhookConfig) error {
	if cfg.ContentType == "" {
		cfg.ContentType = "form"
	}

	hook := &github.Hook{
		URL:    &cfg.URL,
		Events: cfg.Events,
		Active: &cfg.Active,
		Config: &github.HookConfig{
			ContentType: &cfg.ContentType,
			Secret:      &cfg.Secret,
			URL:         &cfg.URL,
		},
	}
	_, _, err := r.gh.Repositories.CreateHook(ctx, owner, repository, hook)
	var ghErr *github.ErrorResponse
	if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
		return ErrServiceUnavailable
	}
	return err
}

func (r *realImpl) DeleteWebhook(ctx context.Context, owner, repository string, webhookID int64) error {
	_, err := r.gh.Repositories.DeleteHook(ctx, owner, repository, webhookID)
	var ghErr *github.ErrorResponse
	if !errors.As(err, &ghErr) {
		return err
	}
	if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
		return ErrServiceUnavailable
	}
	if ghErr.Response.StatusCode == http.StatusNotFound {
		return ErrResourceNotFound
	}
	return err
}

func (r *realImpl) EditWebhook(ctx context.Context, owner, repository string, cfg WebhookConfig) error {
	if cfg.ContentType == "" {
		cfg.ContentType = "form"
	}

	hook := &github.Hook{
		URL:    &cfg.URL,
		Events: cfg.Events,
		Active: &cfg.Active,
		Config: &github.HookConfig{
			ContentType: &cfg.ContentType,
			Secret:      &cfg.Secret,
			URL:         &cfg.URL,
		},
	}
	_, _, err := r.gh.Repositories.EditHook(ctx, owner, repository, cfg.ID, hook)
	var ghErr *github.ErrorResponse
	if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
		return ErrServiceUnavailable
	}
	return err
}

func (r *realImpl) ListPullRequestFiles(ctx context.Context, owner, repository string, number int) ([]CommitFile, error) {
	commitFiles, _, err := r.gh.PullRequests.ListFiles(ctx, owner, repository, number, nil)
	if err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return nil, ErrServiceUnavailable
		}
		return nil, err
	}

	ret := make([]CommitFile, 0, len(commitFiles))
	for _, f := range commitFiles {
		ret = append(ret, f)
	}

	return ret, nil
}

func (r *realImpl) CreatePullRequestComment(ctx context.Context, owner, repository string, number int, body string) error {
	comment := &github.IssueComment{
		Body: &body,
	}

	if _, _, err := r.gh.Issues.CreateComment(ctx, owner, repository, number, comment); err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return ErrServiceUnavailable
		}
		return err
	}

	return nil
}

func (r *realImpl) CreatePullRequestFileComment(ctx context.Context, owner, repository string, number int, comment FileComment) error {
	commentRequest := &github.PullRequestComment{
		Body:     &comment.Content,
		CommitID: &comment.Ref,
		Path:     &comment.Path,
		Position: &comment.Position,
	}

	if _, _, err := r.gh.PullRequests.CreateComment(ctx, owner, repository, number, commentRequest); err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return ErrServiceUnavailable
		}

		return err
	}

	return nil
}

func (r *realImpl) ClearAllPullRequestFileComments(ctx context.Context, owner, repository string, number int) error {
	comments, _, err := r.gh.PullRequests.ListComments(ctx, owner, repository, number, nil)
	if err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return ErrServiceUnavailable
		}
		return err
	}

	userLogin, _, err := r.gh.Users.Get(ctx, "")
	if err != nil {
		return fmt.Errorf("get user: %w", err)
	}

	for _, c := range comments {
		// skip if comments were not created by us
		if c.User.GetLogin() != userLogin.GetLogin() {
			continue
		}

		if _, err := r.gh.PullRequests.DeleteComment(ctx, owner, repository, c.GetID()); err != nil {
			return fmt.Errorf("delete comment: %w", err)
		}
	}

	return nil
}

type realRepositoryContent struct {
	real *github.RepositoryContent
}

var _ RepositoryContent = realRepositoryContent{}

func (c realRepositoryContent) IsDirectory() bool {
	return c.real.GetType() == "dir"
}

func (c realRepositoryContent) GetFileContent() (string, error) {
	return c.real.GetContent()
}

func (c realRepositoryContent) IsSymlink() bool {
	return c.real.Target != nil
}

func (c realRepositoryContent) GetPath() string {
	return c.real.GetPath()
}

func (c realRepositoryContent) GetSHA() string {
	return c.real.GetSHA()
}

func (c realRepositoryContent) GetSize() int64 {
	if c.real.Size != nil {
		return int64(*c.real.Size)
	}
	if c.real.Content != nil {
		if c, err := c.real.GetContent(); err == nil {
			return int64(len(c))
		}
	}
	return 0
}
