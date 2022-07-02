import { parser } from '@grafana/lezer-logql';

import { QueryBuilderLabelFilter } from '../prometheus/querybuilder/shared/types';

import { LokiQueryModeller } from './querybuilder/LokiQueryModeller';
import { buildVisualQueryFromString } from './querybuilder/parsing';
import { LokiVisualQuery } from './querybuilder/types';

/**
 * Adds label filter to existing query. Useful for query modification for example for ad hoc filters.
 *
 * It uses LogQL parser to find instances of labels, alters them and then splices them back into the query.
 * In a case when we have parser, instead of adding new instance of label it adds label filter after the parser.
 *
 * This operates on substrings of the query with labels and operates just on those. This makes this
 * more robust and can alter even invalid queries, and preserves in general the query structure and whitespace.
 *
 * @param query
 * @param key
 * @param value
 * @param operator
 */
export function addLabelToQuery(query: string, key: string, operator: string, value: string): string {
  if (!key || !value) {
    throw new Error('Need label to add to query.');
  }

  const streamSelectorPositions = getStreamSelectorPositions(query);
  const parserPositions = getParserPositions(query);
  if (!streamSelectorPositions.length) {
    return query;
  }

  const filter = toLabelFilter(key, value, operator);
  if (!parserPositions.length) {
    return addFilterToStreamSelector(query, streamSelectorPositions, filter);
  } else {
    return addFilterAsLabelFilter(query, parserPositions, filter);
  }
}

type StreamSelectorPosition = { from: number; to: number; query: LokiVisualQuery };
type PipelineStagePosition = { from: number; to: number };

/**
 * Parse the string and get all Selector positions in the query together with parsed representation of the
 * selector.
 * @param query
 */
function getStreamSelectorPositions(query: string): StreamSelectorPosition[] {
  const tree = parser.parse(query);
  const positions: StreamSelectorPosition[] = [];
  tree.iterate({
    enter: (type, from, to, get): false | void => {
      if (type.name === 'Selector') {
        const visQuery = buildVisualQueryFromString(query.substring(from, to));
        positions.push({ query: visQuery.query, from, to });
        return false;
      }
    },
  });
  return positions;
}

/**
 * Parse the string and get all LabelParser positions in the query.
 * @param query
 */
function getParserPositions(query: string): PipelineStagePosition[] {
  const tree = parser.parse(query);
  const positions: PipelineStagePosition[] = [];
  tree.iterate({
    enter: (type, from, to, get): false | void => {
      if (type.name === 'LabelParser') {
        positions.push({ from, to });
        return false;
      }
    },
  });
  return positions;
}

function toLabelFilter(key: string, value: string, operator: string): QueryBuilderLabelFilter {
  // We need to make sure that we convert the value back to string because it may be a number
  return { label: key, op: operator, value };
}

/**
 * Add filter as to stream selectors
 * @param query
 * @param vectorSelectorPositions
 * @param filter
 */
function addFilterToStreamSelector(
  query: string,
  vectorSelectorPositions: StreamSelectorPosition[],
  filter: QueryBuilderLabelFilter
): string {
  const modeller = new LokiQueryModeller();
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
    const newLabels = modeller.renderQuery(match.query);
    newQuery += start + newLabels + end;
    prev = match.to;
  }
  return newQuery;
}

/**
 * Add filter as label filter after the parsers
 * @param query
 * @param parserPositions
 * @param filter
 */
function addFilterAsLabelFilter(
  query: string,
  parserPositions: PipelineStagePosition[],
  filter: QueryBuilderLabelFilter
): string {
  let newQuery = '';
  let prev = 0;

  for (let i = 0; i < parserPositions.length; i++) {
    // This is basically just doing splice on a string for each matched vector selector.
    const match = parserPositions[i];
    const isLast = i === parserPositions.length - 1;

    const start = query.substring(prev, match.to);
    const end = isLast ? query.substring(match.to) : '';

    const labelFilter = ` | ${filter.label}${filter.op}\`${filter.value}\``;
    newQuery += start + labelFilter + end;
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
