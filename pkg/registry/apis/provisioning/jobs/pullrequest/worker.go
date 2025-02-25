package pullrequest

import (
	"context"
	"errors"
	"fmt"
	"os"

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
	linter    *Linter
	previewer *Previewer
}

func NewPullRequestWorker(
	parsers *resources.ParserFactory,
	previewer *Previewer,
	linter *Linter,
) (*PullRequestWorker, error) {
	return &PullRequestWorker{
		parsers:   parsers,
		linter:    linter,
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

	// TODO: Figure out how we want to determine this in practice.
	lintingVal, ok := os.LookupEnv("GRAFANA_LINTING")
	linting := ok && lintingVal == "true"

	// TODO: clean specification to have better options
	if !linting &&
		!cfg.GitHub.GenerateDashboardPreviews {
		progress.SetMessage("linting and previews are not required")
		return nil
	}

	logger := logging.FromContext(ctx).With("pr", options.PR)
	logger.Info("process pull request")
	defer logger.Info("pull request processed")

	progress.SetMessage("listing pull request files")
	base := cfg.GitHub.Branch
	ref := options.Hash
	files, err := prRepo.CompareFiles(ctx, base, ref)
	if err != nil {
		return fmt.Errorf("failed to list pull request files: %s", err.Error())
	}

	progress.SetMessage("clearing pull request comments")
	if err := prRepo.ClearAllPullRequestFileComments(ctx, options.PR); err != nil {
		return fmt.Errorf("failed to clear pull request comments: %+v", err)
	}

	if len(files) == 0 {
		progress.SetMessage("no files to process")
		return nil
	}

	progress.SetMessage("processing pull request files")
	previews := make([]resourcePreview, 0, len(files))
	for _, f := range files {
		result := jobs.JobResourceResult{
			Path: f.Path,
		}

		if resources.ShouldIgnorePath(f.Path) {
			result.Action = repository.FileActionIgnored
			progress.Record(ctx, result)
			continue
		}
		result.Action = f.Action

		fileInfo, err := prRepo.Read(ctx, f.Path, ref)
		if err != nil {
			return fmt.Errorf("read file: %w", err)
		}

		parsed, err := parser.Parse(ctx, fileInfo, true)
		if err != nil {
			if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
				logger.Debug("file is not a resource", "path", f.Path)
				result.Action = repository.FileActionIgnored
				progress.Record(ctx, result)
			} else {
				result.Error = fmt.Errorf("failed to parse resource: %w", err)
				progress.Record(ctx, result)
			}
			continue
		}

		result.Resource = parsed.GVR.Resource
		result.Group = parsed.GVR.Group
		result.Name = parsed.Obj.GetName()

		if f.Action != repository.FileActionDeleted {
			if err := c.linter.Lint(ctx, prRepo, options, f.Path, ref, parsed.Lint); err != nil {
				result.Error = fmt.Errorf("failed to lint file: %w", err)
				progress.Record(ctx, result)
				continue
			}
		}

		preview, err := c.previewer.CreatePreview(ctx, f, job.Namespace, repo.Config().Name, cfg.GitHub.Branch, ref, options.URL)
		if err != nil {
			result.Error = fmt.Errorf("create preview: %w", err)
			progress.Record(ctx, result)
			continue
		}

		previews = append(previews, *preview)
		progress.Record(ctx, result)
	}

	if len(previews) == 0 || !cfg.GitHub.GenerateDashboardPreviews {
		progress.SetMessage("no previews to add")
		return nil
	}

	progress.SetMessage("generating previews comment")
	comment, err := c.previewer.GenerateComment(previews)
	if err != nil {
		return fmt.Errorf("generate comment: %w", err)
	}

	if err := prRepo.CommentPullRequest(ctx, options.PR, comment); err != nil {
		return fmt.Errorf("comment pull request: %w", err)
	}
	logger.Info("previews comment added", "number", len(previews))

	return nil
}
