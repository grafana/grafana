// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/add_label_to_query.ts
import { parser, VectorSelector } from '@prometheus-io/lezer-promql';

import { buildVisualQueryFromString } from './querybuilder/parsing';
import { renderQuery } from './querybuilder/shared/rendering/query';
import { QueryBuilderLabelFilter } from './querybuilder/shared/types';
import { PromVisualQuery } from './querybuilder/types';

/**
 * Adds label filter to existing query. Useful for query modification for example for ad hoc filters.
 *
 * It uses PromQL parser to find instances of metric and labels, alters them and then splices them back into the query.
 * Ideally we could use the parse -> change -> render is a simple 3 steps but right now building the visual query
 * object does not support all possible queries.
 *
 * So instead this just operates on substrings of the query with labels and operates just on those. This makes this
 * more robust and can alter even invalid queries, and preserves in general the query structure and whitespace.
 * @param query
 * @param key
 * @param value
 * @param operator
 */
export function addLabelToQuery(query: string, key: string, value: string | number, operator = '='): string {
  if (!key) {
    throw new Error('Need label to add to query.');
  }

  const vectorSelectorPositions = getVectorSelectorPositions(query);
  if (!vectorSelectorPositions.length) {
    return query;
  }

  const filter = toLabelFilter(key, value, operator);
  return addFilter(query, vectorSelectorPositions, filter);
}

type VectorSelectorPosition = { from: number; to: number; query: PromVisualQuery };

/**
 * Parse the string and get all VectorSelector positions in the query together with parsed representation of the vector
 * selector.
 * @param query
 */
function getVectorSelectorPositions(query: string): VectorSelectorPosition[] {
  const tree = parser.parse(query);
  const positions: VectorSelectorPosition[] = [];
  tree.iterate({
    enter: ({ to, from, type }): false | void => {
      if (type.id === VectorSelector) {
        const visQuery = buildVisualQueryFromString(query.substring(from, to));
        positions.push({ query: visQuery.query, from, to });
        return false;
      }
    },
  });
  return positions;
}

function toLabelFilter(key: string, value: string | number, operator: string): QueryBuilderLabelFilter {
  // We need to make sure that we convert the value back to string because it may be a number
  const transformedValue = value === Infinity ? '+Inf' : value.toString();
  return { label: key, op: operator, value: transformedValue };
}

function addFilter(
  query: string,
  vectorSelectorPositions: VectorSelectorPosition[],
  filter: QueryBuilderLabelFilter
): string {
  let newQuery = '';
  let prev = 0;

  for (let i = 0; i < vectorSelectorPositions.length; i++) {
    // This is basically just doing splice on a string for each matched vector selector.

    const match = vectorSelectorPositions[i];
    const isLast = i === vectorSelectorPositions.length - 1;

    const start = query.substring(prev, match.from);
    const end = isLast ? query.substring(match.to) : '';

    if (!labelExists(match.query.labels, filter)) {
      // We don't want to add duplicate labels.
      match.query.labels.push(filter);
    }
    const newLabels = renderQuery(match.query);
    newQuery += start + newLabels + end;
    prev = match.to;
  }
  return newQuery;
}

/**
 * Check if label exists in the list of labels but ignore the operator.
 * @param labels
 * @param filter
 */
function labelExists(labels: QueryBuilderLabelFilter[], filter: QueryBuilderLabelFilter) {
  return labels.find((label) => label.label === filter.label && label.value === filter.value);
}
