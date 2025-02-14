package export

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	dashboards "github.com/grafana/grafana/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ resource.BatchResourceWriter = (*resourceReader)(nil)

type resourceReader struct {
	job    *exportJob
	logger logging.Logger
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
		return fmt.Errorf("failed to unmarshal unstructured: %w", err)
	}

	err = f.job.add(ctx, item)
	if err != nil {
		f.logger.Warn("error adding from legacy", "name", key.Name, "err", err)
		// f.summary.Errors = append(f.summary.Errors, fmt.Sprintf("%s: %s", key.Name, err.Error()))
		// if len(f.summary.Errors) > 50 {
		// 	return err
		// }
	}
	return nil
}

func (r *exportJob) loadResources(ctx context.Context) error {
	kinds := []schema.GroupVersionResource{{
		Group:    dashboards.GROUP,
		Resource: dashboards.DASHBOARD_RESOURCE,
		Version:  "v1alpha1",
	}}

	for _, kind := range kinds {
		r.progress.SetMessage(fmt.Sprintf("exporting %s resource", kind.Resource))
		if r.legacy != nil {
			r.progress.SetMessage(fmt.Sprintf("migrate %s resource", kind.Resource))
			gr := kind.GroupResource()
			reader := &resourceReader{
				job:    r,
				logger: r.logger,
			}
			opts := legacy.MigrateOptions{
				Namespace:   r.namespace,
				WithHistory: r.withHistory,
				Resources:   []schema.GroupResource{gr},
				Store:       parquet.NewBatchResourceWriterClient(reader),
				OnlyCount:   true, // first get the count
			}
			_, err := r.legacy.Migrate(ctx, opts)
			if err != nil {
				return fmt.Errorf("unable to count legacy items %w", err)
			}

			// if len(stats.Summary) > 0 {
			// 	count := stats.Summary[0].Count
			// 	history := stats.Summary[0].History
			// 	if history > count {
			// 		count = history // the number of items we will process
			// 	}
			// 	reader.summary.Total = count
			// }

			opts.OnlyCount = false // this time actually write
			_, err = r.legacy.Migrate(ctx, opts)
			if err != nil {
				return fmt.Errorf("error running legacy migrate %s %w", kind.Resource, err)
			}
		}

		r.progress.SetMessage(fmt.Sprintf("reading %s resource", kind.Resource))
		if err := r.loadResourcesFromAPIServer(ctx, kind); err != nil {
			return fmt.Errorf("error loading %s %w", kind.Resource, err)
		}
	}
	return nil
}

func (r *exportJob) loadResourcesFromAPIServer(ctx context.Context, kind schema.GroupVersionResource) error {
	client := r.client.Resource(kind)

	continueToken := ""
	for {
		list, err := client.List(ctx, metav1.ListOptions{Limit: 100, Continue: continueToken})
		if err != nil {
			return fmt.Errorf("error executing list: %w", err)
		}

		for _, item := range list.Items {
			if err = r.add(ctx, &item); err != nil {
				return fmt.Errorf("error adding value: %w", err)
			}
		}

		continueToken = list.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return nil
}
