package migrate

import (
	"context"
	"errors"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/features"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/open-feature/go-sdk/openfeature"
)

type MigrationWorker struct {
	namespaceCleaner NamespaceCleaner
	exportWorker     jobs.Worker
	syncWorker       jobs.Worker
}

func NewMigrationWorker(
	namespaceCleaner NamespaceCleaner,
	exportWorker jobs.Worker,
	syncWorker jobs.Worker,
) *MigrationWorker {
	return &MigrationWorker{
		namespaceCleaner: namespaceCleaner,
		exportWorker:     exportWorker,
		syncWorker:       syncWorker,
	}
}

func (w *MigrationWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionMigrate
}

func (w *MigrationWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) (processErr error) {
	options := job.Spec.Migrate
	if options == nil {
		return errors.New("missing migrate settings")
	}

	cfg := repo.Config()
	evalCtx := features.EvaluationContextFromTargetingKey(cfg.Namespace)
	enabled := openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagProvisioningExport, false, evalCtx)
	if !enabled {
		// A disabled feature is an expected configuration state, not a failure:
		// complete the job in a warning state so it is not logged or alerted as an error.
		return jobs.AsWarning(errors.New("migrate functionality is disabled"))
	}

	logger := logging.FromContext(ctx).With("options", options)
	ctx = logging.Context(ctx, logger)
	ctx, span := tracing.Start(ctx, "provisioning.migrate.process")
	defer func() {
		if processErr != nil {
			_ = tracing.Error(span, processErr)
		}
		span.End()
	}()

	progress.SetTotal(ctx, 10) // will show a progress bar
	rw, ok := repo.(repository.ReaderWriter)
	if !ok {
		return errors.New("migration job submitted targeting repository that is not a ReaderWriter")
	}

	return w.migrate(ctx, rw, job, progress)
}
