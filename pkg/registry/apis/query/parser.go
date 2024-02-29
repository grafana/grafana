package query

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
)

type parsedQueryRequest struct {
	// The queries broken into requests
	Requests []groupedQueries

	// Optionally show the additional query properties
	Expressions []resource.GenericDataQuery
}

type groupedQueries struct {
	// the plugin type
	pluginId string

	// The datasource name/uid
	uid string

	// The raw backend query objects
	query []resource.GenericDataQuery
}

// Internally define what makes this request unique (eventually may include the apiVersion)
func (d *groupedQueries) key() string {
	return fmt.Sprintf("%s/%s", d.pluginId, d.uid)
}

func parseQueryRequest(raw v0alpha1.GenericQueryRequest) (parsedQueryRequest, error) {
	mixed := make(map[string]*groupedQueries)
	parsed := parsedQueryRequest{}
	refIds := make(map[string]bool)

	for _, original := range raw.Queries {
		if refIds[original.RefID] {
			return parsed, fmt.Errorf("invalid query, duplicate refId: " + original.RefID)
		}

		refIds[original.RefID] = true
		q := original

		if q.TimeRange == nil && raw.From != "" {
			q.TimeRange = &resource.TimeRange{
				From: raw.From,
				To:   raw.To,
			}
		}

		// Extract out the expressions queries earlier
		if expr.IsDataSource(q.Datasource.Type) || expr.IsDataSource(q.Datasource.UID) {
			parsed.Expressions = append(parsed.Expressions, q)
			continue
		}

		g := &groupedQueries{pluginId: q.Datasource.Type, uid: q.Datasource.UID}
		group, ok := mixed[g.key()]
		if !ok || group == nil {
			group = g
			mixed[g.key()] = g
		}
		group.query = append(group.query, q)
	}

	// for _, q := range parsed.Expressions {
	// 	// TODO: parse and build tree, for now just fail fast on unknown commands
	// 	_, err := expr.GetExpressionCommandType(q.Additional)
	// 	if err != nil {
	// 		return parsed, err
	// 	}
	// }

	// Add each request
	for _, v := range mixed {
		parsed.Requests = append(parsed.Requests, *v)
	}

	return parsed, nil
}
