package provisioning

import (
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"

	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	provinformer "github.com/grafana/grafana/apps/provisioning/pkg/informer"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/setting"
)

// newInformerFactory builds the provisioning informer factory for the operators.
// When a NATS subscriber is present and enabled, the informers keep their
// LIST-seeded caches but take their watch deltas from a NATS consumer instead of
// the apiserver watch.
func newInformerFactory(client versioned.Interface, resync time.Duration, subscriber nats.Subscriber) informers.SharedInformerFactory {
	if subscriber != nil && subscriber.Enabled() {
		logging.DefaultLogger.Info("provisioning operator informers using NATS-backed watch")
		watchFn := informer.NewConsumer(subscriber, resync).Watch
		return informers.NewSharedInformerFactory(provinformer.WrapClient(client, watchFn), resync)
	}
	return informers.NewSharedInformerFactory(client, resync)
}

// newNATSSubscriber builds the NATS subscriber from configuration. It connects
// lazily on first Subscribe and is a no-op transport when NATS is disabled
// (Enabled() reports false, so newInformerFactory falls back to the apiserver
// watch). Operators run against an external NATS, so there is no embedded
// server: a nil server yields a config that dials the configured client URLs.
func newNATSSubscriber(cfg *setting.Cfg, reg prometheus.Registerer) nats.Subscriber {
	return nats.ProvideSubscriber(cfg, nats.ProvideNATSConfig(cfg, nil), reg)
}
