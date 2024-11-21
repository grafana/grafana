package loki

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/grafana/grafana/pkg/tsdb/loki/kinds/dataquery"
	"github.com/grafana/loki/v3/pkg/logql/syntax"
	"github.com/prometheus/prometheus/promql/parser"
)

// SuggestionRequest is the request body for the GetSuggestions resource.
type SuggestionRequest struct {
	// LabelName, if provided, will result in label values being returned for the given label name.
	LabelName string `json:"labelName"`

	Query string `json:"query"`

	Scopes       []models.ScopeFilter `json:"scopes"`
	AdhocFilters []models.ScopeFilter `json:"adhocFilters"`

	// Start and End are proxied directly to the prometheus endpoint (which is rfc3339 | unix_timestamp)
	Start string `json:"start"`
	End   string `json:"end"`
}

// GetSuggestions returns label names or label values for the given queries and scopes.
func GetSuggestions(ctx context.Context, lokiAPI *LokiAPI, req *backend.CallResourceRequest) (RawLokiResponse, error) {
	sugReq := SuggestionRequest{}
	err := json.Unmarshal(req.Body, &sugReq)
	if err != nil {
		return RawLokiResponse{}, fmt.Errorf("error unmarshalling suggestion request: %v", err)
	}

	values := url.Values{}
	if sugReq.Query != "" {
		// the query is used to find label/labelvalues the duration and interval does not matter.
		// If the user want to filter values based on time it should used the `start` and `end` fields
		interpolatedQuery := interpolateVariables(sugReq.Query, time.Minute, time.Minute, dataquery.LokiQueryTypeRange, time.Minute)

		if len(sugReq.Scopes) > 0 {
			rewrittenQuery, err := ApplyScopes(interpolatedQuery, sugReq.Scopes)
			if err == nil {
				values.Add("query", rewrittenQuery)
			} else {
				values.Add("query", interpolatedQuery)
			}
		}
	} else if len(sugReq.Scopes) > 0 {
		matchers, err := models.FiltersToMatchers(sugReq.Scopes, sugReq.AdhocFilters)
		if err != nil {
			return RawLokiResponse{}, fmt.Errorf("error converting filters to matchers: %v", err)
		}
		vs := parser.VectorSelector{LabelMatchers: matchers}
		values.Add("query", vs.String())
	}

	if sugReq.Start != "" {
		values.Add("start", sugReq.Start)
	}

	if sugReq.End != "" {
		values.Add("end", sugReq.End)
	}

	var path string
	if sugReq.LabelName != "" {
		path = "/loki/api/v1/label/" + url.QueryEscape(sugReq.LabelName) + "/values?" + values.Encode()
	} else {
		path = "/loki/api/v1/labels?" + values.Encode()
	}

	return lokiAPI.RawQuery(ctx, path)
}

// ApplyScopes applies the given scope filters to the given raw expression.
func ApplyScopes(rawExpr string, scopeFilters []models.ScopeFilter) (string, error) {
	if len(scopeFilters) == 0 {
		return rawExpr, nil
	}

	scopeMatchers, err := models.FiltersToMatchers(scopeFilters, nil)
	if err != nil {
		return "", fmt.Errorf("failed to convert filters to matchers: %w", err)
	}

	// Need WithoutValidation to allow empty `{}` expressions
	syntaxTree, err := syntax.ParseExprWithoutValidation(rawExpr)
	if err != nil {
		return "", fmt.Errorf("failed to parse raw expression: %w", err)
	}

	syntaxTree.Walk(func(e syntax.Expr) {
		switch e := e.(type) {
		case *syntax.MatchersExpr:
			// TODO: Key Collisions?
			e.Mts = append(e.Mts, scopeMatchers...)
		default:
		}
	})
	return syntaxTree.String(), nil
}
