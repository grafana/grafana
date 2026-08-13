package annotation

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	authtypes "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/app"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

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
	accessClient authtypes.AccessClient,
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

		// Tags are an org-wide aggregate, so gate the request on org-level
		// annotation read before exposing any tag metadata.
		if err = authorizeReadOrganizationAnnotations(ctx, accessClient, namespace); err != nil {
			return err
		}

		opts := TagListOptions{}
		queryParams := request.URL.Query()

		prefix := queryParams.Get("prefix")
		contains := queryParams.Get("contains")
		if prefix != "" && contains != "" {
			return apierrors.NewBadRequest(fmt.Sprintf("%v: prefix and contains are mutually exclusive", ErrInvalidInput))
		}
		opts.Prefix = prefix
		opts.Contains = contains

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
