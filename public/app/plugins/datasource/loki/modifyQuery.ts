import { NodeType, SyntaxNode } from '@lezer/common';
import { sortBy } from 'lodash';

import {
  Identifier,
  JsonExpressionParser,
  LabelFilter,
  LabelParser,
  LineComment,
  LineFilters,
  LogExpr,
  LogRangeExpr,
  Matcher,
  parser,
  PipelineExpr,
  Selector,
  UnwrapExpr,
  String,
} from '@grafana/lezer-logql';

import { QueryBuilderLabelFilter } from '../prometheus/querybuilder/shared/types';

import { unescapeLabelValue } from './languageUtils';
import { lokiQueryModeller as modeller } from './querybuilder/LokiQueryModeller';
import { buildVisualQueryFromString, handleQuotes } from './querybuilder/parsing';

export class NodePosition {
  from: number;
  to: number;
  type?: NodeType;

  constructor(from: number, to: number, type?: NodeType) {
    this.from = from;
    this.to = to;
    this.type = type;
  }

  static fromNode(node: SyntaxNode): NodePosition {
    return new NodePosition(node.from, node.to, node.type);
  }

  contains(position: NodePosition): boolean {
    return this.from <= position.from && this.to >= position.to;
  }

  getExpression(query: string): string {
    return query.substring(this.from, this.to);
  }
}

/**
 * Checks for the presence of a given label=value filter in any Matcher expression in the query.
 */
export function queryHasFilter(query: string, key: string, operator: string, value: string): boolean {
  const matchers = getMatchersWithFilter(query, key, operator, value);
  return matchers.length > 0;
}

/**
 * Removes a label=value Matcher expression from the query.
 */
export function removeLabelFromQuery(query: string, key: string, operator: string, value: string): string {
  const matchers = getMatchersWithFilter(query, key, operator, value);
  for (const matcher of matchers) {
    query =
      matcher.parent?.type.id === LabelFilter ? removeLabelFilter(query, matcher) : removeSelector(query, matcher);
  }
  return query;
}

function removeLabelFilter(query: string, matcher: SyntaxNode): string {
  const pipelineStage = matcher.parent?.parent;
  if (!pipelineStage) {
    return query;
  }
  return (query.substring(0, pipelineStage.from) + query.substring(pipelineStage.to)).trim();
}

function removeSelector(query: string, matcher: SyntaxNode): string {
  let selector: SyntaxNode | null = matcher;
  do {
    selector = selector.parent;
  } while (selector && selector.type.id !== Selector);
  const label = matcher.getChild(Identifier);
  if (!selector || !label) {
    return query;
  }
  const labelName = query.substring(label.from, label.to);

  const prefix = query.substring(0, selector.from);
  const suffix = query.substring(selector.to);

  const matchVisQuery = buildVisualQueryFromString(query.substring(selector.from, selector.to));
  matchVisQuery.query.labels = matchVisQuery.query.labels.filter((label) => label.label !== labelName);

  return prefix + modeller.renderQuery(matchVisQuery.query) + suffix;
}

function getMatchersWithFilter(query: string, key: string, operator: string, value: string): SyntaxNode[] {
  const tree = parser.parse(query);
  const matchers: SyntaxNode[] = [];
  tree.iterate({
    enter: ({ type, node }): void => {
      if (type.id === Matcher) {
        matchers.push(node);
      }
    },
  });
  return matchers.filter((matcher) => {
    const labelNode = matcher.getChild(Identifier);
    const opNode = labelNode?.nextSibling;
    const valueNode = matcher.getChild(String);
    if (!labelNode || !opNode || !valueNode) {
      return false;
    }
    const labelName = query.substring(labelNode.from, labelNode.to);
    if (labelName !== key) {
      return false;
    }
    const labelValue = query.substring(valueNode.from, valueNode.to);
    if (handleQuotes(labelValue) !== unescapeLabelValue(value)) {
      return false;
    }
    const labelOperator = query.substring(opNode.from, opNode.to);
    if (labelOperator !== operator) {
      return false;
    }
    return true;
  });
}

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
  if (!streamSelectorPositions.length) {
    return query;
  }

  const hasStreamSelectorMatchers = getMatcherInStreamPositions(query);
  const everyStreamSelectorHasMatcher = streamSelectorPositions.every((streamSelectorPosition) =>
    hasStreamSelectorMatchers.some(
      (matcherPosition) =>
        matcherPosition.from >= streamSelectorPosition.from && matcherPosition.to <= streamSelectorPosition.to
    )
  );
  const parserPositions = getParserPositions(query);
  const labelFilterPositions = getLabelFilterPositions(query);

  const filter = toLabelFilter(key, value, operator);
  // If we have non-empty stream selector and parser/label filter, we want to add a new label filter after the last one.
  // If some of the stream selectors don't have matchers, we want to add new matcher to the all stream selectors.
  if (everyStreamSelectorHasMatcher && (labelFilterPositions.length || parserPositions.length)) {
    const positionToAdd = findLastPosition([...labelFilterPositions, ...parserPositions]);
    return addFilterAsLabelFilter(query, [positionToAdd], filter);
  } else {
    return addFilterToStreamSelector(query, streamSelectorPositions, filter);
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
    if (!streamSelectorPositions.length) {
      return query;
    }
    return addParser(query, streamSelectorPositions, parser);
  }
}

/**
 * Adds filtering for pipeline errors to existing query. Useful for query modification for hints.
 * It uses LogQL parser to find parsers and adds pipeline errors filtering after them.
 *
 * @param query
 */
export function addNoPipelineErrorToQuery(query: string): string {
  const parserPositions = getParserPositions(query);
  if (!parserPositions.length) {
    return query;
  }

  const filter = toLabelFilter('__error__', '', '=');
  return addFilterAsLabelFilter(query, parserPositions, filter);
}

/**
 * Adds label format to existing query. Useful for query modification for hints.
 * It uses LogQL parser to find log query and add label format at the end.
 *
 * @param query
 * @param labelFormat
 */
export function addLabelFormatToQuery(query: string, labelFormat: { originalLabel: string; renameTo: string }): string {
  const logQueryPositions = getLogQueryPositions(query);
  return addLabelFormat(query, logQueryPositions, labelFormat);
}

/**
 * Removes all comments from query.
 * It uses  LogQL parser to find all LineComments and removes them.
 */
export function removeCommentsFromQuery(query: string): string {
  const lineCommentPositions = getLineCommentPositions(query);

  if (!lineCommentPositions.length) {
    return query;
  }

  let newQuery = '';
  let prev = 0;

  for (let lineCommentPosition of lineCommentPositions) {
    newQuery = newQuery + query.substring(prev, lineCommentPosition.from);
    prev = lineCommentPosition.to;
  }
  newQuery = newQuery + query.substring(prev);
  return newQuery;
}

/**
 * Parse the string and get all Selector positions in the query together with parsed representation of the
 * selector.
 * @param query
 */
export function getStreamSelectorPositions(query: string): NodePosition[] {
  const tree = parser.parse(query);
  const positions: NodePosition[] = [];
  tree.iterate({
    enter: ({ type, from, to }): false | void => {
      if (type.id === Selector) {
        positions.push(new NodePosition(from, to, type));
        return false;
      }
    },
  });
  return positions;
}

function getMatcherInStreamPositions(query: string): NodePosition[] {
  const tree = parser.parse(query);
  const positions: NodePosition[] = [];
  tree.iterate({
    enter: ({ node }): false | void => {
      if (node.type.id === Selector) {
        positions.push(...getAllPositionsInNodeByType(query, node, Matcher));
      }
    },
  });
  return positions;
}

/**
 * Parse the string and get all LabelParser positions in the query.
 * @param query
 */
export function getParserPositions(query: string): NodePosition[] {
  const tree = parser.parse(query);
  const positions: NodePosition[] = [];
  tree.iterate({
    enter: ({ type, from, to }): false | void => {
      if (type.id === LabelParser || type.id === JsonExpressionParser) {
        positions.push(new NodePosition(from, to, type));
        return false;
      }
    },
  });
  return positions;
}

/**
 * Parse the string and get all LabelFilter positions in the query.
 * @param query
 */
export function getLabelFilterPositions(query: string): NodePosition[] {
  const tree = parser.parse(query);
  const positions: NodePosition[] = [];
  tree.iterate({
    enter: ({ type, from, to }): false | void => {
      if (type.id === LabelFilter) {
        positions.push(new NodePosition(from, to, type));
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
function getLineFiltersPositions(query: string): NodePosition[] {
  const tree = parser.parse(query);
  const positions: NodePosition[] = [];
  tree.iterate({
    enter: ({ type, from, to }): false | void => {
      if (type.id === LineFilters) {
        positions.push(new NodePosition(from, to, type));
        return false;
      }
    },
  });
  return positions;
}

/**
 * Parse the string and get all Log query positions in the query.
 * @param query
 */
function getLogQueryPositions(query: string): NodePosition[] {
  const tree = parser.parse(query);
  const positions: NodePosition[] = [];
  tree.iterate({
    enter: ({ type, from, to, node }): false | void => {
      if (type.id === LogExpr) {
        positions.push(new NodePosition(from, to, type));
        return false;
      }

      // This is a case in metrics query
      if (type.id === LogRangeExpr) {
        // Unfortunately, LogRangeExpr includes both log and non-log (e.g. Duration/Range/...) parts of query.
        // We get position of all log-parts within LogRangeExpr: Selector, PipelineExpr and UnwrapExpr.
        const logPartsPositions: NodePosition[] = [];
        const selector = node.getChild(Selector);
        if (selector) {
          logPartsPositions.push(NodePosition.fromNode(selector));
        }

        const pipeline = node.getChild(PipelineExpr);
        if (pipeline) {
          logPartsPositions.push(NodePosition.fromNode(pipeline));
        }

        const unwrap = node.getChild(UnwrapExpr);
        if (unwrap) {
          logPartsPositions.push(NodePosition.fromNode(unwrap));
        }

        // We sort them and then pick "from" from first position and "to" from last position.
        const sorted = sortBy(logPartsPositions, (position) => position.to);
        positions.push(new NodePosition(sorted[0].from, sorted[sorted.length - 1].to));
        return false;
      }
    },
  });
  return positions;
}

export function toLabelFilter(key: string, value: string, operator: string): QueryBuilderLabelFilter {
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
  vectorSelectorPositions: NodePosition[],
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
 * @param positionsToAddAfter
 * @param filter
 */
export function addFilterAsLabelFilter(
  query: string,
  positionsToAddAfter: NodePosition[],
  filter: QueryBuilderLabelFilter
): string {
  let newQuery = '';
  let prev = 0;

  for (let i = 0; i < positionsToAddAfter.length; i++) {
    // This is basically just doing splice on a string for each matched vector selector.
    const match = positionsToAddAfter[i];
    const isLast = i === positionsToAddAfter.length - 1;

    const start = query.substring(prev, match.to);
    const end = isLast ? query.substring(match.to) : '';

    let labelFilter = '';
    // For < and >, if the value is number, we don't add quotes around it and use it as number
    if (!Number.isNaN(Number(filter.value)) && (filter.op === '<' || filter.op === '>')) {
      labelFilter = ` | ${filter.label}${filter.op}${Number(filter.value)}`;
    } else {
      // we now unescape all escaped values again, because we are using backticks which can handle those cases.
      // we also don't care about the operator here, because we need to unescape for both, regex and equal.
      labelFilter = ` | ${filter.label}${filter.op}\`${unescapeLabelValue(filter.value)}\``;
    }

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
function addParser(query: string, queryPartPositions: NodePosition[], parser: string): string {
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
 * Add filter as label filter after the parsers
 * @param query
 * @param logQueryPositions
 * @param labelFormat
 */
function addLabelFormat(
  query: string,
  logQueryPositions: NodePosition[],
  labelFormat: { originalLabel: string; renameTo: string }
): string {
  let newQuery = '';
  let prev = 0;

  for (let i = 0; i < logQueryPositions.length; i++) {
    // This is basically just doing splice on a string for each matched vector selector.
    const match = logQueryPositions[i];
    const isLast = i === logQueryPositions.length - 1;

    const start = query.substring(prev, match.to);
    const end = isLast ? query.substring(match.to) : '';

    const labelFilter = ` | label_format ${labelFormat.renameTo}=${labelFormat.originalLabel}`;
    newQuery += start + labelFilter + end;
    prev = match.to;
  }
  return newQuery;
}

export function addLineFilter(query: string): string {
  const streamSelectorPositions = getStreamSelectorPositions(query);
  if (!streamSelectorPositions.length) {
    return query;
  }
  const streamSelectorEnd = streamSelectorPositions[0].to;

  const newQueryExpr = query.slice(0, streamSelectorEnd) + ' |= ``' + query.slice(streamSelectorEnd);
  return newQueryExpr;
}

function getLineCommentPositions(query: string): NodePosition[] {
  const tree = parser.parse(query);
  const positions: NodePosition[] = [];
  tree.iterate({
    enter: ({ type, from, to }): false | void => {
      if (type.id === LineComment) {
        positions.push(new NodePosition(from, to, type));
        return false;
      }
    },
  });
  return positions;
}

/**
 * Check if label exists in the list of labels but ignore the operator.
 * @param labels
 * @param filter
 */
function labelExists(labels: QueryBuilderLabelFilter[], filter: QueryBuilderLabelFilter) {
  return labels.find((label) => label.label === filter.label && label.value === filter.value);
}

/**
 * Return the last position based on "to" property
 * @param positions
 */
export function findLastPosition(positions: NodePosition[]): NodePosition {
  return positions.reduce((prev, current) => (prev.to > current.to ? prev : current));
}

function getAllPositionsInNodeByType(query: string, node: SyntaxNode, type: number): NodePosition[] {
  if (node.type.id === type) {
    return [NodePosition.fromNode(node)];
  }

  const positions: NodePosition[] = [];
  let pos = 0;
  let child = node.childAfter(pos);
  while (child) {
    positions.push(...getAllPositionsInNodeByType(query, child, type));
    pos = child.to;
    child = node.childAfter(pos);
  }
  return positions;
}
