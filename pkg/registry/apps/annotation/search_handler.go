package annotation

import (
	"context"
	"encoding/json"
	"net/url"
	"strconv"

	"github.com/grafana/grafana-app-sdk/app"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func newSearchHandler(store Store) func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	return func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
		namespace := request.ResourceIdentifier.Namespace

		queryParams := request.URL.Query()
		opts := listOptionsFromQueryParams(queryParams)

		result, err := store.List(ctx, namespace, opts)
		if err != nil {
			return err
		}

		response := &annotationV0.AnnotationList{
			Items:    result.Items,
			ListMeta: metav1.ListMeta{Continue: result.Continue},
		}

		writer.Header().Set("Content-Type", "application/json")
		return json.NewEncoder(writer).Encode(response)
	}
}

func listOptionsFromQueryParams(queryParams url.Values) ListOptions {
	opts := ListOptions{}

	if v := queryParams.Get("dashboardUID"); v != "" {
		opts.DashboardUID = v
	}

	if v := queryParams.Get("panelID"); v != "" {
		if panelID, err := strconv.ParseInt(v, 10, 64); err == nil {
			opts.PanelID = panelID
		}
	}

	if v := queryParams.Get("from"); v != "" {
		if from, err := strconv.ParseInt(v, 10, 64); err == nil {
			opts.From = from
		}
	}

	if v := queryParams.Get("to"); v != "" {
		if to, err := strconv.ParseInt(v, 10, 64); err == nil {
			opts.To = to
		}
	}

	opts.Limit = 100
	if v := queryParams.Get("limit"); v != "" {
		if limit, err := strconv.ParseInt(v, 10, 64); err == nil && limit > 0 {
			opts.Limit = limit
		}
	}

	if v := queryParams.Get("continue"); v != "" {
		opts.Continue = v
	}

	if tags, ok := queryParams["tag"]; ok {
		opts.Tags = tags
	}

	if v := queryParams.Get("tagsMatchAny"); v != "" {
		if matchAny, err := strconv.ParseBool(v); err == nil {
			opts.TagsMatchAny = matchAny
		}
	}

	if scopes, ok := queryParams["scope"]; ok {
		opts.Scopes = scopes
	}

	if v := queryParams.Get("scopesMatchAny"); v != "" {
		if matchAny, err := strconv.ParseBool(v); err == nil {
			opts.ScopesMatchAny = matchAny
		}
	}

	return opts
}
