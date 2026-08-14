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
		inner := jobs.NewMockJobProgressRecorder(t)
		inner.EXPECT().Record(ctx, jobs.NewGVKResult("dash-1", dashboardGVK).
			WithAction(repository.FileActionCreated).Build())
		inner.EXPECT().Record(ctx, jobs.NewGVKResult("dash-2", dashboardGVK).
			WithAction(repository.FileActionCreated).Build())

		collector := newExportedResourceCollector(inner)

		collector.Record(ctx, jobs.NewGVKResult("dash-1", dashboardGVK).
			WithAction(repository.FileActionCreated).Build())
		collector.Record(ctx, jobs.NewGVKResult("dash-2", dashboardGVK).
			WithAction(repository.FileActionCreated).Build())

		allowlist := collector.ExportedResources()
		require.NotNil(t, allowlist)
		assert.True(t, allowlist.Contains(resources.ResourceIdentifier{Name: "dash-1", Group: "dashboard.grafana.app", Kind: "Dashboard"}))
		assert.True(t, allowlist.Contains(resources.ResourceIdentifier{Name: "dash-2", Group: "dashboard.grafana.app", Kind: "Dashboard"}))
		assert.False(t, allowlist.Contains(resources.ResourceIdentifier{Name: "dash-3", Group: "dashboard.grafana.app", Kind: "Dashboard"}))
	})

	t.Run("ignores failed exports", func(t *testing.T) {
		inner := jobs.NewMockJobProgressRecorder(t)
		inner.EXPECT().Record(ctx, jobs.NewGVKResult("dash-1", dashboardGVK).
			WithAction(repository.FileActionIgnored).
			WithError(assert.AnError).Build())

		collector := newExportedResourceCollector(inner)

		collector.Record(ctx, jobs.NewGVKResult("dash-1", dashboardGVK).
			WithAction(repository.FileActionIgnored).
			WithError(assert.AnError).Build())

		allowlist := collector.ExportedResources()
		assert.False(t, allowlist.Contains(resources.ResourceIdentifier{Name: "dash-1", Group: "dashboard.grafana.app", Kind: "Dashboard"}))
	})

	t.Run("ignores ignored resources", func(t *testing.T) {
		inner := jobs.NewMockJobProgressRecorder(t)
		inner.EXPECT().Record(ctx, jobs.NewGVKResult("dash-1", dashboardGVK).
			WithAction(repository.FileActionIgnored).Build())

		collector := newExportedResourceCollector(inner)

		collector.Record(ctx, jobs.NewGVKResult("dash-1", dashboardGVK).
			WithAction(repository.FileActionIgnored).Build())

		allowlist := collector.ExportedResources()
		assert.False(t, allowlist.Contains(resources.ResourceIdentifier{Name: "dash-1", Group: "dashboard.grafana.app", Kind: "Dashboard"}))
	})

	t.Run("ignores results without a name", func(t *testing.T) {
		inner := jobs.NewMockJobProgressRecorder(t)
		inner.EXPECT().Record(ctx, jobs.NewResourceResult().
			WithAction(repository.FileActionCreated).Build())

		collector := newExportedResourceCollector(inner)

		collector.Record(ctx, jobs.NewResourceResult().
			WithAction(repository.FileActionCreated).Build())

		allowlist := collector.ExportedResources()
		assert.False(t, allowlist.Contains(resources.ResourceIdentifier{Name: "", Group: "", Kind: ""}))
	})
}
