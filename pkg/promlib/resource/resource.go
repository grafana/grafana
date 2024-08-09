package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/grafana/dskit/concurrency"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data/utils/maputil"
	"github.com/prometheus/prometheus/promql/parser"

	"github.com/grafana/grafana/pkg/promlib/client"
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
		log:        plog,
		promClient: client.NewClient(httpClient, httpMethod, settings.URL),
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

func (r *Resource) DetectVersion(ctx context.Context, req *backend.CallResourceRequest) (*backend.CallResourceResponse, error) {
	newReq := &backend.CallResourceRequest{
		PluginContext: req.PluginContext,
		Path:          "/api/v1/status/buildinfo",
	}

	return r.Execute(ctx, newReq)
}

func (r *Resource) GetSelectors(ctx context.Context, req *backend.CallResourceRequest) (*backend.CallResourceResponse, error) {
	// TODO: Takes a list of queries and returns the selectors for the queries
	// Note: Not sure if I need to interpolate any query macros. Will make it expect
	// fully formed queries for now.
	promExpressions := []string{}
	err := json.Unmarshal(req.Body, &promExpressions)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling prometheus expressions: %v", err)
	}

	selectors := map[string]struct{}{}

	for _, rawExpr := range promExpressions {
		expr, err := parser.ParseExpr(rawExpr)
		// might want to return a warning and keep trying more expressions if not too many errors?
		if err != nil {
			return nil, fmt.Errorf("error parsing prometheus expression: %v", err)
		}

		// might want to only select from expressions that contain an aggregate clause?
		parser.Inspect(expr, func(node parser.Node, nodes []parser.Node) error {
			switch v := node.(type) {
			// There is a GetSelectors in parser, but it doesn't match Matrix Selectors, do I need that?
			// scopes may need that as well.
			case *parser.VectorSelector:
				for _, matcher := range v.LabelMatchers {
					if matcher == nil {
						continue
					}
					if matcher.Name == "__name__" {
						selectors[matcher.Value] = struct{}{}
					}
				}
			}
			return nil
		})
	}

	// TODO remove duplicates
	selectorList := make([]string, 0, len(selectors))
	for selector := range selectors {
		selectorList = append(selectorList, selector)
	}

	sets := [][]string{}

	err = concurrency.ForEachJob(ctx, len(selectorList), 10, func(ctx context.Context, idx int) error {
		values := url.Values{}
		values.Add("match[]", selectorList[idx])
		newReq := &backend.CallResourceRequest{
			PluginContext: req.PluginContext,
			Path:          "/api/v1/labels",
			URL:           "/api/v1/labels?" + values.Encode(),
		}

		res, err := r.Execute(ctx, newReq)
		if err != nil {
			return err
		}

		lR := labelsResponse{}

		if err := json.Unmarshal(res.Body, &lR); err != nil {
			return fmt.Errorf("error unmarshalling labels response: %v", err)
		}
		sets = append(sets, lR.Data)
		return nil
	})

	if err != nil {
		return nil, err

	}

	resp := &backend.CallResourceResponse{
		Status:  http.StatusOK,
		Headers: make(map[string][]string),
	}

	resp.Body, err = json.Marshal(getIntersection(sets))
	if err != nil {
		return nil, err
	}

	return resp, nil
}

type labelsResponse struct {
	Status string   `json:"status"`
	Data   []string `json:"data"`
}

func getIntersection(sets [][]string) []string {
	counts := make(map[string]int)

	for _, set := range sets {
		for _, v := range set {
			if v == "__name__" {
				continue
			}
			counts[v]++
		}
	}

	intersection := []string{}
	for k, count := range counts {
		if count == len(sets) {
			intersection = append(intersection, k)
		}
	}
	return intersection
}
