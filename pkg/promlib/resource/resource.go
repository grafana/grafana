package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data/utils/maputil"
	"github.com/prometheus/prometheus/promql/parser"

	"github.com/grafana/grafana/pkg/promlib/client"
	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/grafana/grafana/pkg/promlib/utils"
)

type Resource struct {
	promClient *client.Client
	log        log.Logger
}

func New(
	httpClient *http.Client,
	settings backend.DataSourceInstanceSettings,
	plog log.Logger,
) (*Resource, error) {
	jsonData, err := utils.GetJsonData(settings)
	if err != nil {
		return nil, err
	}
	httpMethod, _ := maputil.GetStringOptional(jsonData, "httpMethod")

	if httpMethod == "" {
		httpMethod = http.MethodPost
	}

	return &Resource{
		log: plog,
		// we don't use queryTimeout for resource calls
		promClient: client.NewClient(httpClient, httpMethod, settings.URL, ""),
	}, nil
}

func (r *Resource) Execute(ctx context.Context, req *backend.CallResourceRequest) (*backend.CallResourceResponse, error) {
	r.log.FromContext(ctx).Debug("Sending resource query", "URL", req.URL)
	resp, err := r.promClient.QueryResource(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("error querying resource: %v", err)
	}

	// frontend sets the X-Grafana-Cache with the desired response cache control value
	if len(req.GetHTTPHeaders().Get("X-Grafana-Cache")) > 0 {
		resp.Header.Set("X-Grafana-Cache", "y")
		resp.Header.Set("Cache-Control", req.GetHTTPHeaders().Get("X-Grafana-Cache"))
	}

	defer func() {
		tmpErr := resp.Body.Close()
		if tmpErr != nil && err == nil {
			err = tmpErr
		}
	}()

	var buf bytes.Buffer
	// Should be more efficient than ReadAll. See https://github.com/prometheus/client_golang/pull/976
	_, err = buf.ReadFrom(resp.Body)
	body := buf.Bytes()
	if err != nil {
		return nil, err
	}
	callResponse := &backend.CallResourceResponse{
		Status:  resp.StatusCode,
		Headers: resp.Header,
		Body:    body,
	}

	return callResponse, err
}

func getSelectors(expr string) ([]string, error) {
	parsed, err := parser.ParseExpr(expr)
	if err != nil {
		return nil, err
	}

	selectors := make([]string, 0)

	parser.Inspect(parsed, func(node parser.Node, nodes []parser.Node) error {
		switch v := node.(type) {
		case *parser.VectorSelector:
			for _, matcher := range v.LabelMatchers {
				if matcher == nil {
					continue
				}
				if matcher.Name == "__name__" {
					selectors = append(selectors, matcher.Value)
				}
			}
		}
		return nil
	})

	return selectors, nil
}

// SuggestionRequest is the request body for the GetSuggestions resource.
type SuggestionRequest struct {
	// LabelName, if provided, will result in label values being returned for the given label name.
	LabelName string `json:"labelName"`

	Queries []string `json:"queries"`

	Scopes       []models.ScopeFilter `json:"scopes"`
	AdhocFilters []models.ScopeFilter `json:"adhocFilters"`

	// Start and End are proxied directly to the prometheus endpoint (which is rfc3339 | unix_timestamp)
	Start string `json:"start"`
	End   string `json:"end"`

	// Limit is the maximum number of suggestions to return and is proxied directly to the prometheus endpoint.
	Limit int64 `json:"limit"`
}

// GetSuggestions takes a Suggestion Request in the body of the resource request.
// It builds a to call prometheus' labels endpoint (or label values endpoint if labelName is provided)
// The match parameters for the endpoints are built from metrics extracted from the queries
// combined with the scopes and adhoc filters provided in the request.
// Queries must be valid raw promql.
func (r *Resource) GetSuggestions(ctx context.Context, req *backend.CallResourceRequest) (*backend.CallResourceResponse, error) {
	sugReq := SuggestionRequest{}
	err := json.Unmarshal(req.Body, &sugReq)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling suggestion request: %v", err)
	}

	selectorList := []string{}
	for _, query := range sugReq.Queries {
		// Since we are only extracting selectors from the metric name, we can use dummy
		// time durations.
		interpolatedQuery := models.InterpolateVariables(
			query,
			time.Minute,
			time.Minute,
			"1m",
			"15s",
			time.Minute,
		)
		s, err := getSelectors(interpolatedQuery)
		if err != nil {
			r.log.Warn("error parsing selectors", "error", err, "query", interpolatedQuery)
			continue
		}
		selectorList = append(selectorList, s...)
	}

	slices.Sort(selectorList)
	selectorList = slices.Compact(selectorList)

	matchers, err := models.FiltersToMatchers(sugReq.Scopes, sugReq.AdhocFilters)
	if err != nil {
		return nil, fmt.Errorf("error converting filters to matchers: %v", err)
	}

	values := url.Values{}
	for _, s := range selectorList {
		vs := parser.VectorSelector{Name: s, LabelMatchers: matchers}
		values.Add("match[]", vs.String())
	}

	// if no timeserie name is provided, but scopes or adhoc filters are, the scope is still rendered and passed as match param.
	if len(selectorList) == 0 && len(matchers) > 0 {
		vs := parser.VectorSelector{LabelMatchers: matchers}
		values.Add("match[]", vs.String())
	}

	if sugReq.Start != "" {
		values.Add("start", sugReq.Start)
	}
	if sugReq.End != "" {
		values.Add("end", sugReq.End)
	}
	if sugReq.Limit > 0 {
		values.Add("limit", fmt.Sprintf("%d", sugReq.Limit))
	}

	newReq := &backend.CallResourceRequest{
		PluginContext: req.PluginContext,
	}

	if sugReq.LabelName != "" {
		// Get label values for the given name (key)
		newReq.Path = "/api/v1/label/" + sugReq.LabelName + "/values"
		newReq.URL = "/api/v1/label/" + sugReq.LabelName + "/values?" + values.Encode()
	} else {
		// Get Label names (keys)
		newReq.Path = "/api/v1/labels"
		newReq.URL = "/api/v1/labels?" + values.Encode()
	}

	return r.Execute(ctx, newReq)
}
