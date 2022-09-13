// Package searchstore converts search queries to SQL.
//
// Because of the wide array of deployments supported by Grafana,
// search strives to be both performant enough to handle heavy users
// and lightweight enough to not increase complexity/resource
// utilization for light users. To allow this we're currently searching
// without fuzziness and in a single SQL query.
//
// Search queries are a combination of an outer query which Builder
// creates automatically when calling the Builder.ToSQL method and an
// inner query feeding that which lists the IDs of the dashboards that
// should be part of the result set. By default search will return all
// dashboards (behind pagination) but it is possible to dynamically add
// filters capable of adding more specific inclusion or ordering
// requirements.
//
// A filter is any data type which implements one or more of the
// FilterWhere, FilterGroupBy, FilterOrderBy, or FilterLeftJoin
// interfaces. The filters will be applied (in order) to limit or
// reorder the results.
//
// Filters will be applied in order with the final result like such:
//
//	SELECT id FROM dashboard LEFT OUTER JOIN <FilterLeftJoin...>
//	WHERE <FilterWhere[0]> AND ... AND <FilterWhere[n]>
//	GROUP BY <FilterGroupBy...>
//	ORDER BY <FilterOrderBy...>
//	LIMIT <limit> OFFSET <(page-1)*limit>;
//
// This structure is intended to isolate the filters from each other
// and implementors are expected to add all the required joins, where
// clauses, groupings, and/or orderings necessary for applying a
// filter in the filter. Using side-effects of other filters is
// bad manners and increases the complexity and volatility of the code.
package searchstore
