package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/go-github/v66/github"
)

type realImpl struct {
	gh *github.Client
}

var _ Client = (*realImpl)(nil)

func NewRealClient(client *github.Client) *realImpl {
	return &realImpl{client}
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
