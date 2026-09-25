package migrate

import (
	"context"
	"sync"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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

// ExportedNonFolderResources returns the references of the successfully exported
// resources, excluding folders. A selective branch migration uses this to delete
// only the resources it migrated: folders are emitted purely to resolve paths and
// may be shared with resources that were not migrated, so they are left in place.
// Safe to call after the export phase completes.
func (c *exportedResourceCollector) ExportedNonFolderResources() []provisioning.ResourceRef {
	c.mu.Lock()
	defer c.mu.Unlock()

	folder := resources.FolderKind.GroupKind()
	refs := make([]provisioning.ResourceRef, 0, len(c.exported))
	for id := range c.exported {
		if id.Group == folder.Group && id.Kind == folder.Kind {
			continue
		}
		refs = append(refs, provisioning.ResourceRef{Name: id.Name, Group: id.Group, Kind: id.Kind})
	}
	return refs
}
