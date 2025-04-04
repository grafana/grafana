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
	parsers   *resources.ParserFactory
	previewer *Previewer
}

func NewPullRequestWorker(
	parsers *resources.ParserFactory,
	previewer *Previewer,
) (*PullRequestWorker, error) {
	return &PullRequestWorker{
		parsers:   parsers,
		previewer: previewer,
	}, nil
}

func (c *PullRequestWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionPullRequest
}

//nolint:gocyclo
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

	prRepo, ok := repo.(PullRequestRepo)
	if !ok {
		return fmt.Errorf("repository is not a github repository")
	}

	reader, ok := repo.(repository.Reader)
	if !ok {
		return errors.New("pull request job submitted targeting repository that is not a Reader")
	}

	parser, err := c.parsers.GetParser(ctx, reader)
	if err != nil {
		return fmt.Errorf("failed to get parser for %s: %w", repo.Config().Name, err)
	}

	logger := logging.FromContext(ctx).With("pr", options.PR)
	logger.Info("process pull request")
	defer logger.Info("pull request processed")

	progress.SetMessage(ctx, "listing pull request files")
	base := cfg.GitHub.Branch
	ref := options.Hash
	files, err := prRepo.CompareFiles(ctx, base, ref)
	if err != nil {
		return fmt.Errorf("failed to list pull request files: %s", err.Error())
	}

	progress.SetMessage(ctx, "clearing pull request comments")
	if err := prRepo.ClearAllPullRequestFileComments(ctx, options.PR); err != nil {
		return fmt.Errorf("failed to clear pull request comments: %+v", err)
	}

	if len(files) == 0 {
		progress.SetFinalMessage(ctx, "no files to process")
		return nil
	}

	if len(files) > 1 {
		progress.SetFinalMessage(ctx, "too many files to preview")
		return nil
	}

	f := files[0]
	progress.SetMessage(ctx, "processing file preview")

	if err := resources.IsPathSupported(f.Path); err != nil {
		progress.SetFinalMessage(ctx, "file path is not supported")
		return nil
	}

	fileInfo, err := prRepo.Read(ctx, f.Path, ref)
	if err != nil {
		return fmt.Errorf("read file: %w", err)
	}

	_, err = parser.Parse(ctx, fileInfo)
	if err != nil {
		if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
			progress.SetFinalMessage(ctx, "file changes is not valid resource")
			return nil
		} else {
			return fmt.Errorf("parse resource: %w", err)
		}
	}

	// Preview should be the branch name if provided, otherwise use the commit hash
	previewRef := options.Ref
	if previewRef == "" {
		previewRef = ref
	}

	preview, err := c.previewer.Preview(ctx, f, job.Namespace, repo.Config().Name, cfg.GitHub.Branch, previewRef, options.URL, cfg.GitHub.GenerateDashboardPreviews)
	if err != nil {
		return fmt.Errorf("generate preview: %w", err)
	}

	progress.SetMessage(ctx, "generating previews comment")
	comment, err := c.previewer.GenerateComment(preview)
	if err != nil {
		return fmt.Errorf("generate comment: %w", err)
	}

	if err := prRepo.CommentPullRequest(ctx, options.PR, comment); err != nil {
		return fmt.Errorf("comment pull request: %w", err)
	}
	logger.Info("preview comment added")

	return nil
}
