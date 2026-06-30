package provisioning

import (
	"time"

	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/apps/provisioning/pkg/informer"
)

// natsWatchEnabled routes the provisioning operators' informers through the
// informer package's watch swap (currently a not-implemented placeholder)
// instead of the apiserver watch, while keeping the LIST-seeded cache. Internal
// switch, defaults to false.
//
// TODO: implement the NATS-based watch (informer.NewNATSInformerFactory) and
// enable this; until then it stays false and the apiserver watch is used.
var natsWatchEnabled = false

// newInformerFactory builds the provisioning informer factory for the operators,
// honouring natsWatchEnabled.
func newInformerFactory(client versioned.Interface, resync time.Duration) informers.SharedInformerFactory {
	if natsWatchEnabled {
		return informer.NewNATSInformerFactory(client, resync)
	}
	return informer.NewInformerFactory(client, resync)
}
