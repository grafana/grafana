package remotecache

import (
	"github.com/prometheus/client_golang/prometheus"
)

// init registers the package's prometheus collectors with the default
// registry so they show up on the /metrics endpoint. Counters are declared
// at package level in the file that uses them, so each metric lives next to
// the code that increments it.
func init() {
	prometheus.MustRegister(upsertDeadlockDropped)
}
