import { parser } from '@grafana/lezer-logql';

import { QueryBuilderLabelFilter } from '../prometheus/querybuilder/shared/types';

import { LokiQueryModeller } from './querybuilder/LokiQueryModeller';
import { buildVisualQueryFromString } from './querybuilder/parsing';

type Position = { from: number; to: number };
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

/**
 * Adds parser to existing query. Useful for query modification for hints.
 * It uses LogQL parser to find instances of stream selectors or line filters and adds parser after them.
 *
 * @param query
 * @param parser
 */
export function addParserToQuery(query: string, parser: string): string {
  const lineFilterPositions = getLineFiltersPositions(query);

  if (lineFilterPositions.length) {
    return addParser(query, lineFilterPositions, parser);
  } else {
    const streamSelectorPositions = getStreamSelectorPositions(query);
    return addParser(query, streamSelectorPositions, parser);
  }
}

/**
 * Parse the string and get all Selector positions in the query together with parsed representation of the
 * selector.
 * @param query
 */
function getStreamSelectorPositions(query: string): Position[] {
  const tree = parser.parse(query);
  const positions: Position[] = [];
  tree.iterate({
    enter: (type, from, to, get): false | void => {
      if (type.name === 'Selector') {
        positions.push({ from, to });
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
export function getParserPositions(query: string): Position[] {
  const tree = parser.parse(query);
  const positions: Position[] = [];
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

/**
 * Parse the string and get all Line filter positions in the query.
 * @param query
 */
function getLineFiltersPositions(query: string): Position[] {
  const tree = parser.parse(query);
  const positions: Position[] = [];
  tree.iterate({
    enter: (type, from, to, get): false | void => {
      if (type.name === 'LineFilters') {
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
  vectorSelectorPositions: Position[],
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
    const matchVisQuery = buildVisualQueryFromString(query.substring(match.from, match.to));

    if (!labelExists(matchVisQuery.query.labels, filter)) {
      // We don't want to add duplicate labels.
      matchVisQuery.query.labels.push(filter);
    }
    const newLabels = modeller.renderQuery(matchVisQuery.query);
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
function addFilterAsLabelFilter(query: string, parserPositions: Position[], filter: QueryBuilderLabelFilter): string {
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
 * Add parser after line filter or stream selector
 * @param query
 * @param queryPartPositions
 * @param parser
 */
function addParser(query: string, queryPartPositions: Position[], parser: string): string {
  let newQuery = '';
  let prev = 0;

  for (let i = 0; i < queryPartPositions.length; i++) {
    // Splice on a string for each matched vector selector
    const match = queryPartPositions[i];
    const isLast = i === queryPartPositions.length - 1;

    const start = query.substring(prev, match.to);
    const end = isLast ? query.substring(match.to) : '';

    // Add parser
    newQuery += start + ` | ${parser}` + end;
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
