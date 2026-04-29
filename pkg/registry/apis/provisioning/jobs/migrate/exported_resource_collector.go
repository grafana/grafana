package migrate

import (
	"context"
	"sync"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// exportedResourceCollector wraps a JobProgressRecorder and captures the
// identifiers of resources that were successfully exported. The collected
// set is later used as a takeover allowlist so the subsequent sync phase
// can claim those specific unmanaged resources.
type exportedResourceCollector struct {
	jobs.JobProgressRecorder
	mu       sync.Mutex
	exported map[resources.ResourceIdentifier]struct{}
}

func newExportedResourceCollector(inner jobs.JobProgressRecorder) *exportedResourceCollector {
	return &exportedResourceCollector{
		JobProgressRecorder: inner,
		exported:            make(map[resources.ResourceIdentifier]struct{}),
	}
}

func (c *exportedResourceCollector) Record(ctx context.Context, result jobs.JobResourceResult) {
	c.JobProgressRecorder.Record(ctx, result)

	if result.Error() == nil && result.Name() != "" &&
		result.Action() == repository.FileActionCreated {
		c.mu.Lock()
		c.exported[resources.ResourceIdentifier{
			Name:  result.Name(),
			Group: result.Group(),
			Kind:  result.Kind(),
		}] = struct{}{}
		c.mu.Unlock()
	}
}

// ExportedResources returns an immutable, concurrency-safe allowlist of
// the resource identifiers that were successfully exported.
// Safe to call after the export phase completes.
func (c *exportedResourceCollector) ExportedResources() *resources.TakeoverAllowlist {
	c.mu.Lock()
	defer c.mu.Unlock()

	return resources.NewTakeoverAllowlist(c.exported)
}
