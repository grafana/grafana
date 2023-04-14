package query

import (
	"context"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type parsedQuery struct {
	datasource *datasources.DataSource
	query      backend.DataQuery
	rawQuery   *simplejson.Json
}

type parsedRequest struct {
	hasExpression bool
	parsedQueries map[string][]parsedQuery
	dsTypes       map[string]bool
}

func (pr parsedRequest) getFlattenedQueries() []parsedQuery {
	queries := make([]parsedQuery, 0)
	for _, pq := range pr.parsedQueries {
		queries = append(queries, pq...)
	}
	return queries
}

func (pr parsedRequest) validateRequest(ctx context.Context) error {
	refIds := make(map[string]bool)
	for _, pq := range pr.parsedQueries {
		for _, q := range pq {
			if refIds[q.query.RefID] {
				return ErrDuplicateRefId
			}
			refIds[q.query.RefID] = true
		}
	}

	// Skip header validation. See https://github.com/grafana/grafana/pull/58871
	if true {
		return nil
	}

	reqCtx := contexthandler.FromContext(ctx)

	if reqCtx == nil || reqCtx.Req == nil {
		return nil
	}

	httpReq := reqCtx.Req

	if pr.hasExpression {
		hasExpr := httpReq.URL.Query().Get("expression")
		if hasExpr == "" || hasExpr == "true" {
			return nil
		}
		return ErrQueryParamMismatch
	}

	vals := splitHeaders(httpReq.Header.Values(HeaderDatasourceUID))
	count := len(vals)
	if count > 0 { // header exists
		if count != len(pr.parsedQueries) {
			return ErrQueryParamMismatch
		}
		for _, t := range vals {
			if pr.parsedQueries[t] == nil {
				return ErrQueryParamMismatch
			}
		}
	}

	vals = splitHeaders(httpReq.Header.Values(HeaderPluginID))
	count = len(vals)
	if count > 0 { // header exists
		if count != len(pr.dsTypes) {
			return ErrQueryParamMismatch
		}
		for _, t := range vals {
			if !pr.dsTypes[t] {
				return ErrQueryParamMismatch
			}
		}
	}
	return nil
}

func splitHeaders(headers []string) []string {
	out := []string{}
	for _, v := range headers {
		if strings.Contains(v, ",") {
			for _, sub := range strings.Split(v, ",") {
				out = append(out, strings.TrimSpace(sub))
			}
		} else {
			out = append(out, v)
		}
	}
	return out
}
