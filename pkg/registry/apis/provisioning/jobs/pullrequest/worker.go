package pullrequest

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type PullRequestRepo interface {
	Config() *provisioning.Repository
	Read(ctx context.Context, path, ref string) (*repository.FileInfo, error)
	CompareFiles(ctx context.Context, base, ref string) ([]repository.VersionedFileChange, error)
	ClearAllPullRequestFileComments(ctx context.Context, pr int) error
	CommentPullRequestFile(ctx context.Context, pr int, path string, ref string, comment string) error
	CommentPullRequest(ctx context.Context, pr int, comment string) error
}

type PullRequestWorker struct {
	parsers     resources.ParserFactory
	renderer    ScreenshotRenderer
	urlProvider func(namespace string) string
	commenter   *commentBuilder
}

func NewPullRequestWorker(
	parsers resources.ParserFactory,
	renderer ScreenshotRenderer,
	urlProvider func(namespace string) string,
) *PullRequestWorker {
	return &PullRequestWorker{
		parsers:     parsers,
		renderer:    renderer,
		urlProvider: urlProvider,
		commenter:   newCommentBuilder(),
	}
}

func (c *PullRequestWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionPullRequest
}

func (c *PullRequestWorker) Process(ctx context.Context,
	repo repository.Repository,
	job provisioning.Job,
	progress jobs.JobProgressRecorder,
) error {
	cfg := repo.Config().Spec
	options := job.Spec.PullRequest
	if options == nil {
		return apierrors.NewBadRequest("missing spec.pr")
	}

	if options.Ref == "" {
		return apierrors.NewBadRequest("missing spec.ref")
	}

	if cfg.GitHub == nil {
		return apierrors.NewBadRequest("expecting github configuration")
	}

	prRepo, ok := repo.(PullRequestRepo)
	if !ok {
		return fmt.Errorf("repository is not a github repository")
	}

	reader, ok := repo.(repository.Reader)
	if !ok {
		return errors.New("pull request job submitted targeting repository that is not a Reader")
	}

	logger := logging.FromContext(ctx).With("pr", options.PR)
	logger.Info("process pull request")
	defer logger.Info("pull request processed")

	progress.SetMessage(ctx, "listing pull request files")
	base := cfg.GitHub.Branch
	files, err := prRepo.CompareFiles(ctx, base, options.Ref)
	if err != nil {
		return fmt.Errorf("failed to list pull request files: %s", err.Error())
	}

	files = onlySupportedFiles(files)

	if len(files) == 0 {
		progress.SetFinalMessage(ctx, "no files to process")
		return nil
	}

	parser, err := c.parsers.GetParser(ctx, reader)
	if err != nil {
		return fmt.Errorf("failed to get parser for %s: %w", repo.Config().Name, err)
	}

	var render ScreenshotRenderer
	if cfg.GitHub.GenerateDashboardPreviews {
		render = c.renderer
	}

	changeInfo, err := processChangedFiles(ctx, changeOptions{
		grafanaBaseURL: c.urlProvider(repo.Config().Namespace),
		pullRequest:    *options,
		changes:        files,
		parser:         parser,
		reader:         reader,
		progress:       progress,
		render:         render,
	})
	if err != nil {
		return fmt.Errorf("unable to calculate changes: %w", err)
	}

	if err := c.commenter.Comment(ctx, prRepo, options.PR, changeInfo); err != nil {
		return fmt.Errorf("comment pull request: %w", err)
	}
	logger.Info("preview comment added")
	return nil
}

// Remove files we should not try to process
func onlySupportedFiles(files []repository.VersionedFileChange) (ret []repository.VersionedFileChange) {
	for _, file := range files {
		if file.Action == repository.FileActionIgnored {
			continue
		}

		if err := resources.IsPathSupported(file.Path); err == nil {
			ret = append(ret, file)
			continue
		}
		if file.PreviousPath != "" {
			if err := resources.IsPathSupported(file.PreviousPath); err != nil {
				ret = append(ret, file)
				continue
			}
		}
	}
	return
}
