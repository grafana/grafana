package controller

import (
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

// Common is what every provisioning controller is built from, whether it runs
// in the Grafana process or in a standalone operator.
type Common struct {
	Client versioned.Interface
	// Subscriber selects the NATS-backed delta sources when nats.Enabled; it
	// may be nil.
	Subscriber nats.Subscriber
	Registry   prometheus.Registerer
	Tracer     tracing.Tracer
}

// Informer configures the delta source and queue of a resource controller.
type Informer struct {
	// Keys makes the NATS re-list keys-only; nil keeps the full-object re-list.
	Keys             keysapi.Lister
	RelistMetrics    *informer.RelistProjectionMetrics
	FreshnessMetrics *informer.FreshnessMetrics
	ResyncInterval   time.Duration
	DrainTimeout     time.Duration
}

// ProvideJobCleanup builds the expired-job reaper. A nil historyWriter records
// reaped jobs through the provisioning API.
func ProvideJobCleanup(common Common, historyWriter jobs.HistoryWriter, expiry time.Duration) (*jobs.JobCleanupController, error) {
	client := common.Client.ProvisioningV0alpha1()
	store, err := jobs.NewJobStore(client, jobs.ClaimExpiry, common.Registry)
	if err != nil {
		return nil, fmt.Errorf("create API client job store: %w", err)
	}
	if historyWriter == nil {
		historyWriter = jobs.NewAPIClientHistoryWriter(client)
	}
	return jobs.NewJobCleanupController(store, historyWriter, expiry), nil
}
