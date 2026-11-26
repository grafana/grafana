package provisioning

import (
	"context"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
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
	*loopbackService

	registry prometheus.Registerer
}

// ProvideJobCleanupService is called by Wire. Depending on the builder orders it
// after [RegisterAPIService], which registers the provisioning API group with
// the API server.
func ProvideJobCleanupService(builder *APIBuilder, registry prometheus.Registerer) *JobCleanupService {
	s := &JobCleanupService{registry: registry}
	s.loopbackService = newLoopbackService(JobCleanupServiceName, builder, s.runController)
	return s
}

func (s *JobCleanupService) runController(ctx context.Context, restConfig *clientrest.Config) error {
	client, err := clientset.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("create provisioning clientset: %w", err)
	}

	b := s.builder
	store, err := jobs.NewJobStore(client.ProvisioningV0alpha1(), jobs.ClaimExpiry, s.registry)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}
	historyWriter := jobs.NewAPIClientHistoryWriter(client.ProvisioningV0alpha1())
	if b.jobHistoryLoki != nil {
		historyWriter = b.jobHistoryLoki
	}

	return jobs.NewJobCleanupController(store, historyWriter, jobs.ClaimExpiry).Run(ctx)
}
