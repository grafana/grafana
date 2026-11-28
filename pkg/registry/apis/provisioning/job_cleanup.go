package provisioning

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/setting"
)

// JobCleanupServiceName is the background-service module name of [JobCleanupService].
const JobCleanupServiceName = "provisioning-job-cleanup"

var _ registry.CanBeDisabled = (*JobCleanupService)(nil)

// JobCleanupService runs the expired-job cleanup controller in the Grafana
// process once the provisioning API is served: it requeues or fails jobs whose
// claim has expired, until shutdown.
type JobCleanupService struct {
	*loopbackService
}

// ProvideJobCleanupService is called by Wire. Depending on the builder orders it
// after [RegisterAPIService], which registers the provisioning API group with
// the API server.
func ProvideJobCleanupService(cfg *setting.Cfg, builder *APIBuilder, registry prometheus.Registerer) *JobCleanupService {
	s := &JobCleanupService{}
	s.loopbackService = newControllerService(JobCleanupServiceName, builder, cfg.DisableControllers, controller.Common{Registry: registry}, s.runController)
	return s
}

func (s *JobCleanupService) runController(ctx context.Context, common controller.Common) error {
	cleanup, err := controller.ProvideJobCleanup(common, s.builder.historyWriter(), jobs.ClaimExpiry)
	if err != nil {
		return err
	}
	return cleanup.Run(ctx)
}

// historyWriter is where background job processing records finished jobs, or
// nil to record them through the provisioning API.
func (b *APIBuilder) historyWriter() jobs.HistoryWriter {
	if b.jobHistoryLoki == nil {
		return nil
	}
	return b.jobHistoryLoki
}
