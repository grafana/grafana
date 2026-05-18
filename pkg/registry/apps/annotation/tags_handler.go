package annotation

import (
	"context"
	"encoding/json"
	"strconv"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
)

type TagResponse struct {
	Tags []TagItem `json:"tags"`
}

type TagItem struct {
	Tag   string `json:"tag"`
	Count int64  `json:"count"`
}

func newTagsHandler(
	tagProvider TagProvider,
	tracer trace.Tracer,
	metrics *Metrics,
	logger log.Logger,
) func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	return func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) (err error) {
		namespace := request.ResourceIdentifier.Namespace

		ctx, span := tracer.Start(ctx, "annotation.k8s.tags", trace.WithAttributes(
			attribute.String("namespace", namespace),
		))
		defer span.End()
		start := time.Now()
		defer func() { observe(ctx, logger, metrics.RequestDuration, "tags", start, err) }()

		opts := TagListOptions{}
		queryParams := request.URL.Query()

		if v := queryParams.Get("prefix"); v != "" {
			opts.Prefix = v
		}

		opts.Limit = 100 // default limit
		if v := queryParams.Get("limit"); v != "" {
			if limit, err := strconv.Atoi(v); err == nil && limit > 0 {
				opts.Limit = limit
			}
		}

		tags, err := tagProvider.ListTags(ctx, namespace, opts)
		if err != nil {
			return err
		}
		items := make([]TagItem, len(tags))
		for i, tag := range tags {
			items[i] = TagItem{
				Tag:   tag.Name,
				Count: tag.Count,
			}
		}
		span.SetAttributes(attribute.Int("item_count", len(items)))

		response := TagResponse{
			Tags: items,
		}

		return json.NewEncoder(writer).Encode(response)
	}
}
