package export

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboards "github.com/grafana/grafana/pkg/apis/dashboard"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ resource.BatchResourceWriter = (*resourceReader)(nil)
)

type resourceReader struct {
	job     *exportJob
	summary *provisioning.JobResourceSummary
}

// Close implements resource.BatchResourceWriter.
func (f *resourceReader) Close() error {
	return nil
}

// CloseWithResults implements resource.BatchResourceWriter.
func (f *resourceReader) CloseWithResults() (*resource.BatchResponse, error) {
	return &resource.BatchResponse{}, nil
}

// Write implements resource.BatchResourceWriter.
func (f *resourceReader) Write(ctx context.Context, key *resource.ResourceKey, value []byte) error {
	item := &unstructured.Unstructured{}
	err := item.UnmarshalJSON(value)
	if err != nil {
		return err
	}
	return f.job.add(ctx, f.summary, item)
}

func (r *exportJob) loadResources(ctx context.Context) error {
	if r.legacy != nil {
		gr := schema.GroupResource{
			Group:    dashboards.GROUP,
			Resource: dashboards.DASHBOARD_RESOURCE,
		}
		reader := &resourceReader{
			summary: r.getSummary(gr),
			job:     r,
		}
		_, err := r.legacy.Migrate(ctx, legacy.MigrateOptions{
			Namespace:   r.namespace,
			WithHistory: r.withHistory,
			Resources:   []schema.GroupResource{gr},
			Store:       parquet.NewBatchResourceWriterClient(reader),
		})
		return err
	}

	kinds := []schema.GroupVersionResource{{
		Group:    dashboards.GROUP,
		Version:  "v1alpha1",
		Resource: dashboards.DASHBOARD_RESOURCE,
	}}
	for _, kind := range kinds {
		err := r.export(ctx, kind)
		if err != nil {
			return err
		}
	}
	return nil
}
