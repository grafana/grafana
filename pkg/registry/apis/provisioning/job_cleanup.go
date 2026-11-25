package provisioning

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"
	clientrest "k8s.io/client-go/rest"

	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

// JobCleanupServiceName is the background-service module name of [JobCleanupService].
const JobCleanupServiceName = "provisioning-job-cleanup"

var _ registry.CanBeDisabled = (*JobCleanupService)(nil)

// JobCleanupService runs the expired-job cleanup controller in the Grafana
// process once the provisioning API is served: it requeues or fails jobs whose
// claim has expired, until shutdown.
type JobCleanupService struct {
	services.NamedService

	builder *APIBuilder
}

// ProvideJobCleanupService is called by Wire. Depending on the builder orders it
// after [RegisterAPIService], which registers the provisioning API group with
// the API server.
func ProvideJobCleanupService(builder *APIBuilder) *JobCleanupService {
	s := &JobCleanupService{builder: builder}
	s.NamedService = services.NewBasicService(nil, s.running, nil).WithName(JobCleanupServiceName)
	return s
}

// IsDisabled implements registry.CanBeDisabled.
func (s *JobCleanupService) IsDisabled() bool {
	return s.builder == nil || s.builder.onlyApiServer
}

// Run implements registry.BackgroundService.
func (s *JobCleanupService) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(context.Background())
}

func (s *JobCleanupService) running(ctx context.Context) error {
	restConfig, err := s.builder.awaitLoopbackConfig(ctx)
	if err == nil {
		err = s.runCleanup(ctx, restConfig)
	}
	if errors.Is(err, context.Canceled) && ctx.Err() != nil {
		return nil
	}
	return err
}

func (s *JobCleanupService) runCleanup(ctx context.Context, restConfig *clientrest.Config) error {
	client, err := clientset.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("create provisioning clientset: %w", err)
	}

	b := s.builder
	store, err := jobs.NewJobStore(client.ProvisioningV0alpha1(), jobClaimExpiry, b.registry)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}
	historyWriter := jobs.NewAPIClientHistoryWriter(client.ProvisioningV0alpha1())
	if b.jobHistoryLoki != nil {
		historyWriter = b.jobHistoryLoki
	}

	logging.DefaultLogger.Info("starting provisioning job cleanup", "claim_expiry", jobClaimExpiry.String())
	return jobs.NewJobCleanupController(store, historyWriter, jobClaimExpiry).Run(ctx)
}
