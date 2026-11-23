package pullrequest

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

// URLsFromConfig returns the URLs of a single-tenant Grafana. Screenshot images
// are fetched server-side by the Git provider's image proxy and must be reachable
// from the public internet, so they prefer public_root_url when set. Clickable
// links stay on AppURL so internal reviewers reach Grafana via the canonical URL.
func URLsFromConfig(cfg *setting.Cfg) URLProvider {
	publicURL := cfg.AppURL
	if cfg.ProvisioningPublicRootURL != "" {
		publicURL = cfg.ProvisioningPublicRootURL
	}
	return URLProvider{
		Internal: func(_ context.Context, _ string) string { return cfg.AppURL },
		Public:   func(_ context.Context, _ string) string { return publicURL },
	}
}

//go:generate mockery --name=Evaluator --structname=MockEvaluator --inpackage --filename=mock_evaluator.go --with-expecter
type Evaluator interface {
	Evaluate(ctx context.Context, repo repository.Reader, opts provisioning.JobPullRequestJobOptions, changes []repository.VersionedFileChange, progress jobs.JobProgressRecorder) (changeInfo, error)
}

//go:generate mockery --name=Commenter --structname=MockCommenter --inpackage --filename=mock_commenter.go --with-expecter
type Commenter interface {
	Comment(ctx context.Context, repo repository.PullRequestRepo, pr int, changeInfo changeInfo) error
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
) (processErr error) {
	opts := job.Spec.Pr
	startTime := time.Now()
	outcome := utils.ErrorOutcome
	defer func() {
		duration := time.Since(startTime)
		c.metrics.recordProcessed(outcome, duration)
	}()

	if opts == nil {
		return apierrors.NewBadRequest("missing spec.pr")
	}

	logger := logging.FromContext(ctx).With("options", opts)
	ctx = logging.Context(ctx, logger)
	ctx, span := tracing.Start(ctx, "provisioning.pullrequest.process")
	defer func() {
		if processErr != nil && !jobs.IsWarning(processErr) {
			_ = tracing.Error(span, processErr)
		}
		span.End()
	}()
	span.SetAttributes(
		attribute.Int("pr.number", int(ptr.Deref(opts.Pr, 0))),
		attribute.String("pr.ref", ptr.Deref(opts.Ref, "")),
		attribute.String("pr.hash", ptr.Deref(opts.Hash, "")),
	)

	if ptr.Deref(opts.Ref, "") == "" {
		logger.Debug("missing spec.ref")
		return apierrors.NewBadRequest("missing spec.ref")
	}

	reader, ok := repo.(repository.Reader)
	if !ok {
		logger.Debug("pull request job submitted targeting repository that is not a Reader")
		return errors.New("pull request job submitted targeting repository that is not a Reader")
	}

	prRepo, ok := repo.(repository.PullRequestRepo)
	if !ok {
		logger.Debug("pull request job submitted targeting repository that is not a PullRequestRepo")
		return fmt.Errorf("repository is not a pull request repository")
	}

	logger.Info("process pull request")
	defer logger.Info("pull request processed")

	if opts.IsFork != nil && *opts.IsFork {
		logger.Info("skipping fork pull request preview")
		if err := c.commenter.Comment(ctx, prRepo, int(ptr.Deref(opts.Pr, 0)), changeInfo{UnsupportedFork: true}); err != nil {
			c.metrics.recordCommentPosted(utils.ErrorOutcome)
			return fmt.Errorf("comment pull request: %w", err)
		}
		c.metrics.recordCommentPosted(utils.SuccessOutcome)
		progress.SetFinalMessage(ctx, unsupportedForkMessage)
		outcome = utils.SuccessOutcome
		return nil
	}

	progress.SetMessage(ctx, "listing pull request files")
	base, err := prRepo.PullRequestClient().MergeBase(ctx, prRepo.Config().Branch(), ptr.Deref(opts.Ref, ""))
	if err != nil {
		base = prRepo.Config().Branch()
		logger.Warn("failed to resolve pull request base, falling back to the configured branch", "error", err, "branch", base)
	}

	files, err := prRepo.CompareFiles(ctx, base, ptr.Deref(opts.Ref, ""))
	if err != nil {
		var missingRef *repository.CompareRefNotFoundError
		if errors.As(err, &missingRef) && missingRef.Ref == ptr.Deref(opts.Ref, "") {
			outcome = string(provisioning.JobStateWarning)
			logger.Info("pull request ref no longer exists, skipping preview", "ref", ptr.Deref(opts.Ref, ""))
			return jobs.AsWarning(fmt.Errorf("pull request ref %q no longer exists; preview skipped", ptr.Deref(opts.Ref, "")))
		}
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

	commentCtx := ctx
	if changeInfo.UnprocessedFiles > 0 {
		// Context may already be cancelled but we want to make the comment
		// to give a preview anyways
		var cancel context.CancelFunc
		commentCtx, cancel = context.WithTimeout(context.WithoutCancel(ctx), 30*time.Second)
		defer cancel()
	}

	if err := c.commenter.Comment(commentCtx, prRepo, int(ptr.Deref(opts.Pr, 0)), changeInfo); err != nil {
		c.metrics.recordCommentPosted(utils.ErrorOutcome)
		return fmt.Errorf("comment pull request: %w", err)
	}
	outcome = utils.SuccessOutcome
	c.metrics.recordCommentPosted(utils.SuccessOutcome)
	logger.Info("preview comment added")

	if changeInfo.UnprocessedFiles > 0 {
		// The comment already posted (with a caveat) covering whatever was evaluated
		// before the context expired -- that's a successful outcome for this worker.
		// Still surface it as a job-level warning so an incomplete evaluation is
		// visible in job history, not indistinguishable from a normal success.
		logger.Warn("pull request evaluation did not cover the whole diff", "unprocessedFiles", changeInfo.UnprocessedFiles)
		return jobs.AsWarning(fmt.Errorf("evaluation stopped early: %d file(s) not processed", changeInfo.UnprocessedFiles))
	}

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
