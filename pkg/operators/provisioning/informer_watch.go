package provisioning

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"

	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/setting"
)

// newInformerFactory builds the apiserver-backed provisioning informer factory
// for the operators. It is used when NATS is not the delta source; under the
// NATS watch the controllers are driven by a NATS-backed informer instead (see natsWatch).
func newInformerFactory(client versioned.Interface, resync time.Duration) informers.SharedInformerFactory {
	return informers.NewSharedInformerFactory(client, resync)
}

// natsWatch reports whether the controllers take their deltas from NATS. When
// they do, there is no informer cache (the NATS-backed informer keeps none), so the
// controllers reconcile through a client-backed getter reading from the API.
func (c *ControllerConfig) natsWatch() bool {
	return c.natsSubscriber != nil && c.natsSubscriber.Enabled()
}

// newNATSSubscriber builds the NATS subscriber from configuration. It connects
// lazily on first Subscribe and is a no-op transport when NATS is disabled
// (Enabled() reports false, so newInformerFactory falls back to the apiserver
// watch). Operators run against an external NATS, so there is no embedded
// server: a nil server yields a config that dials the configured client URLs.
func newNATSSubscriber(cfg *setting.Cfg, reg prometheus.Registerer) nats.Subscriber {
	return nats.ProvideSubscriber(cfg, nats.ProvideNATSConfig(cfg, nil), reg)
}
