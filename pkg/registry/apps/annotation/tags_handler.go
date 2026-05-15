package annotation

import (
	"context"
	"encoding/json"
	"strconv"

	"github.com/grafana/grafana-app-sdk/app"
)

type TagResponse struct {
	Tags []TagItem `json:"tags"`
}

type TagItem struct {
	Tag   string `json:"tag"`
	Count int64  `json:"count"`
}

func newTagsHandler(tagProvider TagProvider) func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	return func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
		namespace := request.ResourceIdentifier.Namespace

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

		response := TagResponse{
			Tags: items,
		}

		return json.NewEncoder(writer).Encode(response)
	}
}
