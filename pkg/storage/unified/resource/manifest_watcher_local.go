package resource

import (
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
)

// localManifestPollInterval is how often in-process storage re-reads the
// router's manifests. The call never leaves the process, so it can run far more
// often than a poll of a remote server.
const localManifestPollInterval = time.Minute

// NewLocalManifestWatcher creates a ManifestWatcher that reads only the
// manifests the router publishes, through discovery. The router fills the set
// on its first reconcile, which runs after storage is built, so the initial poll
// usually finds nothing; the watcher retries quickly until it lists a set.
func NewLocalManifestWatcher(discovery ManifestDiscovery, reg prometheus.Registerer, onChange func([]*app.ManifestData), logger log.Logger) *ManifestWatcher {
	return newManifestWatcher([]manifestSource{discoveryManifestSource(discovery)}, localManifestPollInterval, onChange, logger, reg)
}
