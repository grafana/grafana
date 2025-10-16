package pullrequest

import (
	"context"
	"errors"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
)

func ProvidePullRequestWorker(
	cfg *setting.Cfg,
	renderer rendering.Service,
	blobstore resource.ResourceClient,
	configProvider apiserver.RestConfigProvider,
	registry prometheus.Registerer,
) *PullRequestWorker {
	urlProvider := func(_ context.Context, _ string) string {
		return cfg.AppURL
	}

	// FIXME: we should create providers for client and parsers, so that we don't have
	// multiple connections for webhooks
	clients := resources.NewClientFactory(configProvider)
	parsers := resources.NewParserFactory(clients)
	screenshotRenderer := NewScreenshotRenderer(renderer, blobstore)
	evaluator := NewEvaluator(screenshotRenderer, parsers, urlProvider, registry)
	commenter := NewCommenter()

	return NewPullRequestWorker(evaluator, commenter, registry)
}

//go:generate mockery --name=PullRequestRepo --structname=MockPullRequestRepo --inpackage --filename=mock_pullrequest_repo.go --with-expecter
type PullRequestRepo interface {
	Config() *provisioning.Repository
	Read(ctx context.Context, path, ref string) (*repository.FileInfo, error)
	CompareFiles(ctx context.Context, base, ref string) ([]repository.VersionedFileChange, error)
	CommentPullRequest(ctx context.Context, pr int, comment string) error
}

//go:generate mockery --name=Evaluator --structname=MockEvaluator --inpackage --filename=mock_evaluator.go --with-expecter
type Evaluator interface {
	Evaluate(ctx context.Context, repo repository.Reader, opts provisioning.PullRequestJobOptions, changes []repository.VersionedFileChange, progress jobs.JobProgressRecorder) (changeInfo, error)
}

//go:generate mockery --name=Commenter --structname=MockCommenter --inpackage --filename=mock_commenter.go --with-expecter
type Commenter interface {
	Comment(ctx context.Context, repo PullRequestRepo, pr int, changeInfo changeInfo) error
}

type PullRequestWorker struct {
	evaluator Evaluator
	commenter Commenter
	metrics   pullRequestMetrics
}

func NewPullRequestWorker(evaluator Evaluator, commenter Commenter, registry prometheus.Registerer) *PullRequestWorker {
	metrics := registerPullRequestMetrics(registry)
	return &PullRequestWorker{
		evaluator: evaluator,
		commenter: commenter,
		metrics:   metrics,
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
	opts := job.Spec.PullRequest
	startTime := time.Now()
	outcome := utils.ErrorOutcome
	defer func() {
		duration := time.Since(startTime)
		c.metrics.recordProcessed(outcome, duration)
	}()

	if opts == nil {
		return apierrors.NewBadRequest("missing spec.pr")
	}

	logger := logging.FromContext(ctx).With("pr", opts.PR, "repo", repo.Config().GetName(), "namespace", job.GetNamespace())

	if opts.Ref == "" {
		logger.Debug("missing spec.ref")
		return apierrors.NewBadRequest("missing spec.ref")
	}

	// FIXME: this is leaky because it's supposed to be already a PullRequestRepo
	if cfg.GitHub == nil {
		logger.Debug("expecting github configuration")
		return apierrors.NewBadRequest("expecting github configuration")
	}

	reader, ok := repo.(repository.Reader)
	if !ok {
		logger.Debug("pull request job submitted targeting repository that is not a Reader")
		return errors.New("pull request job submitted targeting repository that is not a Reader")
	}

	prRepo, ok := repo.(PullRequestRepo)
	if !ok {
		logger.Debug("pull request job submitted targeting repository that is not a PullRequestRepo")
		return fmt.Errorf("repository is not a pull request repository")
	}

	logger.Info("process pull request")
	defer logger.Info("pull request processed")

	progress.SetMessage(ctx, "listing pull request files")
	// FIXME: this is leaky because it's supposed to be already a PullRequestRepo
	base := cfg.GitHub.Branch
	files, err := prRepo.CompareFiles(ctx, base, opts.Ref)
	if err != nil {
		logger.Error("failed to list pull request files", "error", err)
		return fmt.Errorf("failed to list pull request files: %w", err)
	}

	files = onlySupportedFiles(files)
	if len(files) == 0 {
		progress.SetFinalMessage(ctx, "no files to process")
		return nil
	}

	changeInfo, err := c.evaluator.Evaluate(ctx, reader, *opts, files, progress)
	if err != nil {
		logger.Error("failed to calculate changes", "error", err)
		return fmt.Errorf("calculate changes: %w", err)
	}

	if err := c.commenter.Comment(ctx, prRepo, opts.PR, changeInfo); err != nil {
		c.metrics.recordCommentPosted(utils.ErrorOutcome)
		return fmt.Errorf("comment pull request: %w", err)
	}
	outcome = utils.SuccessOutcome
	c.metrics.recordCommentPosted(utils.SuccessOutcome)
	logger.Info("preview comment added")

	return nil
}

// Remove files we should not try to process
func onlySupportedFiles(files []repository.VersionedFileChange) (ret []repository.VersionedFileChange) {
	for _, file := range files {
		if file.Action == repository.FileActionIgnored || resources.IsPathSupported(file.Path) != nil {
			continue
		}
		ret = append(ret, file)
	}

	return
}
