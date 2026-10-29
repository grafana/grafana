package migrate

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

var dashboardGVK = schema.GroupVersionKind{Group: "dashboard.grafana.app", Version: "v1", Kind: "Dashboard"}

func TestExportedResourceCollector(t *testing.T) {
	ctx := context.Background()

	t.Run("captures successfully exported resources", func(t *testing.T) {
		// Build each result once and use it for both the expectation and the call:
		// the result carries a construction timestamp, so a freshly rebuilt copy
		// would not compare equal.
		dash1 := jobs.NewGVKResult("dash-1", dashboardGVK).
			WithAction(repository.FileActionCreated).Build()
		dash2 := jobs.NewGVKResult("dash-2", dashboardGVK).
			WithAction(repository.FileActionCreated).Build()

		inner := jobs.NewMockJobProgressRecorder(t)
		inner.EXPECT().Record(ctx, dash1)
		inner.EXPECT().Record(ctx, dash2)

		collector := newExportedResourceCollector(inner)

		collector.Record(ctx, dash1)
		collector.Record(ctx, dash2)

		allowlist := collector.ExportedResources()
		require.NotNil(t, allowlist)
		assert.True(t, allowlist.Contains(resources.ResourceIdentifier{Name: "dash-1", Group: "dashboard.grafana.app", Kind: "Dashboard"}))
		assert.True(t, allowlist.Contains(resources.ResourceIdentifier{Name: "dash-2", Group: "dashboard.grafana.app", Kind: "Dashboard"}))
		assert.False(t, allowlist.Contains(resources.ResourceIdentifier{Name: "dash-3", Group: "dashboard.grafana.app", Kind: "Dashboard"}))
	})

	t.Run("ignores failed exports", func(t *testing.T) {
		dash1 := jobs.NewGVKResult("dash-1", dashboardGVK).
			WithAction(repository.FileActionIgnored).
			WithError(assert.AnError).Build()

		inner := jobs.NewMockJobProgressRecorder(t)
		inner.EXPECT().Record(ctx, dash1)

		collector := newExportedResourceCollector(inner)

		collector.Record(ctx, dash1)

		allowlist := collector.ExportedResources()
		assert.False(t, allowlist.Contains(resources.ResourceIdentifier{Name: "dash-1", Group: "dashboard.grafana.app", Kind: "Dashboard"}))
	})

	t.Run("ignores ignored resources", func(t *testing.T) {
		dash1 := jobs.NewGVKResult("dash-1", dashboardGVK).
			WithAction(repository.FileActionIgnored).Build()

		inner := jobs.NewMockJobProgressRecorder(t)
		inner.EXPECT().Record(ctx, dash1)

		collector := newExportedResourceCollector(inner)

		collector.Record(ctx, dash1)

		allowlist := collector.ExportedResources()
		assert.False(t, allowlist.Contains(resources.ResourceIdentifier{Name: "dash-1", Group: "dashboard.grafana.app", Kind: "Dashboard"}))
	})

	t.Run("ignores results without a name", func(t *testing.T) {
		noName := jobs.NewResourceResult().
			WithAction(repository.FileActionCreated).Build()

		inner := jobs.NewMockJobProgressRecorder(t)
		inner.EXPECT().Record(ctx, noName)

		collector := newExportedResourceCollector(inner)

		collector.Record(ctx, noName)

		allowlist := collector.ExportedResources()
		assert.False(t, allowlist.Contains(resources.ResourceIdentifier{Name: "", Group: "", Kind: ""}))
	})
}
