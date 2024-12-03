import { NodeType, SyntaxNode } from '@lezer/common';
import { sortBy } from 'lodash';

import { QueryBuilderLabelFilter } from '@grafana/experimental';
import {
  Identifier,
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
  PipelineStage,
  LogfmtParser,
  JsonExpressionParser,
  LogfmtExpressionParser,
  Expr,
  LabelFormatExpr,
} from '@grafana/lezer-logql';

import { unescapeLabelValue } from './languageUtils';
import { getNodePositionsFromQuery } from './queryUtils';
import { lokiQueryModeller as modeller } from './querybuilder/LokiQueryModeller';
import { buildVisualQueryFromString, handleQuotes } from './querybuilder/parsing';
import { LabelType } from './types';

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
  if (!pipelineStage || pipelineStage.type.id !== PipelineStage) {
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

function getMatchersWithFilter(query: string, label: string, operator: string, value: string): SyntaxNode[] {
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
    if (labelName !== label) {
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
 */
export function addLabelToQuery(
  query: string,
  key: string,
  operator: string,
  value: string,
  labelType?: LabelType | null
): string {
  if (!key) {
    throw new Error('Need label to add to query.');
  }

  const streamSelectorPositions = getStreamSelectorPositions(query);
  if (!streamSelectorPositions.length) {
    return query;
  }

  const parserPositions = getParserPositions(query);
  const labelFilterPositions = getLabelFilterPositions(query);
  const hasStreamSelectorMatchers = getMatcherInStreamPositions(query);
  // For non-indexed labels we want to add them after label_format to, for example, allow ad-hoc filters to use formatted labels
  const labelFormatPositions = getNodePositionsFromQuery(query, [LabelFormatExpr]);

  // If the label type wasn't passed in from the calling function, we can use lezer to figure out if this label is already in the stream selectors
  if (!labelType) {
    const identifierSelectorMatchers = getIdentifierInStreamPositions(query);
    const indexedKeys = identifierSelectorMatchers.map((match) => match.getExpression(query));
    if (indexedKeys.includes(key)) {
      labelType = LabelType.Indexed;
    }
  }

  const everyStreamSelectorHasMatcher = streamSelectorPositions.every((streamSelectorPosition) =>
    hasStreamSelectorMatchers.some(
      (matcherPosition) =>
        matcherPosition.from >= streamSelectorPosition.from && matcherPosition.to <= streamSelectorPosition.to
    )
  );

  const filter = toLabelFilter(key, value, operator);
  if (labelType === LabelType.Parsed || labelType === LabelType.StructuredMetadata) {
    const lastPositionsPerExpression = getLastPositionPerExpression(query, [
      ...streamSelectorPositions,
      ...labelFilterPositions,
      ...parserPositions,
      ...labelFormatPositions,
    ]);

    return addFilterAsLabelFilter(query, lastPositionsPerExpression, filter);
  } else if (labelType === LabelType.Indexed) {
    return addFilterToStreamSelector(query, streamSelectorPositions, filter);
  } else {
    // labelType is not set, so we need to figure out where to add the label
    // if we don't have a parser, or have empty stream selectors, we will just add it to the stream selector
    if (parserPositions.length === 0 || everyStreamSelectorHasMatcher === false) {
      return addFilterToStreamSelector(query, streamSelectorPositions, filter);
    } else {
      // If `labelType` is not set, it indicates a potential metric query (`labelType` is present only in log queries that came from a Loki instance supporting the `categorize-labels` API). In case we are not adding the label to stream selectors we need to find the last position to add in each expression.
      // E.g. in `sum(rate({foo="bar"} | logfmt [$__auto])) / sum(rate({foo="baz"} | logfmt [$__auto]))` we need to add the label at two places.
      const lastPositionsPerExpression = getLastPositionPerExpression(query, [
        ...parserPositions,
        ...labelFilterPositions,
        ...labelFormatPositions,
      ]);

      return addFilterAsLabelFilter(query, lastPositionsPerExpression, filter);
    }
  }
}

function getLastPositionPerExpression(query: string, positions: NodePosition[]): NodePosition[] {
  const subExpressions = findLeaves(getNodePositionsFromQuery(query, [Expr]));
  const subPositions = [...positions];

  // find last position for each subexpression
  const lastPositionsPerExpression = subExpressions.map((subExpression) => {
    return findLastPosition(
      subPositions.filter((p) => {
        return subExpression.contains(p);
      })
    );
  });
  return lastPositionsPerExpression;
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
    return appendToLogsQuery(query, lineFilterPositions, parser);
  } else {
    const streamSelectorPositions = getStreamSelectorPositions(query);
    if (!streamSelectorPositions.length) {
      return query;
    }
    return appendToLogsQuery(query, streamSelectorPositions, parser);
  }
}

/**
 * Adds a drop statement to the query.
 * It uses LogQL parser to find instances of stream selectors or line filters and adds parser after them.
 *
 * @param query
 * @param parser
 */
export function addDropToQuery(query: string, labelsToDrop: string[]): string {
  const lineFilterPositions = getLineFiltersPositions(query);

  if (lineFilterPositions.length) {
    return appendToLogsQuery(query, lineFilterPositions, `drop ${labelsToDrop.join(', ')}`);
  } else {
    const streamSelectorPositions = getStreamSelectorPositions(query);
    if (!streamSelectorPositions.length) {
      return query;
    }
    return appendToLogsQuery(query, streamSelectorPositions, `drop ${labelsToDrop.join(', ')}`);
  }
}

/**
 * Adds a statement after line filters or stream selectors
 * @param query
 * @param queryPartPositions
 * @param parser
 */
function appendToLogsQuery(query: string, queryPartPositions: NodePosition[], statement: string): string {
  let newQuery = '';
  let prev = 0;

  for (let i = 0; i < queryPartPositions.length; i++) {
    // Splice on a string for each matched vector selector
    const match = queryPartPositions[i];
    const isLast = i === queryPartPositions.length - 1;

    const start = query.substring(prev, match.to);
    const end = isLast ? query.substring(match.to) : '';

    // Add parser
    newQuery += start + ` | ${statement}` + end;
    prev = match.to;
  }
  return newQuery;
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
    enter: ({ type, node }): false | void => {
      if (type.id === Selector) {
        positions.push(NodePosition.fromNode(node));
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
export function getParserPositions(query: string): NodePosition[] {
  const tree = parser.parse(query);
  const positions: NodePosition[] = [];
  const parserNodeTypes = [LabelParser, JsonExpressionParser, LogfmtParser, LogfmtExpressionParser];
  tree.iterate({
    enter: ({ type, node }): false | void => {
      if (parserNodeTypes.includes(type.id)) {
        positions.push(NodePosition.fromNode(node));
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
    enter: ({ type, node }): false | void => {
      if (type.id === LabelFilter) {
        positions.push(NodePosition.fromNode(node));
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
    enter: ({ type, node }): false | void => {
      if (type.id === LineFilters) {
        positions.push(NodePosition.fromNode(node));
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
    enter: ({ type, node }): false | void => {
      if (type.id === LogExpr) {
        positions.push(NodePosition.fromNode(node));
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

export function addLineFilter(query: string, value = '', operator = '|='): string {
  const streamSelectorPositions = getStreamSelectorPositions(query);
  if (!streamSelectorPositions.length) {
    return query;
  }
  const streamSelectorEnd = streamSelectorPositions[0].to;

  const newQueryExpr = query.slice(0, streamSelectorEnd) + ` ${operator} \`${value}\`` + query.slice(streamSelectorEnd);
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
  if (!positions.length) {
    return new NodePosition(0, 0);
  }
  return positions.reduce((prev, current) => (prev.to > current.to ? prev : current));
}

/**
 * Gets all leaves of the nodes given. Leaves are nodes that don't contain any other nodes.
 *
 * @param {NodePosition[]} nodes
 * @return
 */
function findLeaves(nodes: NodePosition[]): NodePosition[] {
  return nodes.filter((node) => nodes.every((n) => node.contains(n) === false || node === n));
}

function getAllPositionsInNodeByType(node: SyntaxNode, type: number): NodePosition[] {
  if (node.type.id === type) {
    return [NodePosition.fromNode(node)];
  }

  const positions: NodePosition[] = [];
  let pos = 0;
  let child = node.childAfter(pos);
  while (child) {
    positions.push(...getAllPositionsInNodeByType(child, type));
    pos = child.to;
    child = node.childAfter(pos);
  }
  return positions;
}

function getMatcherInStreamPositions(query: string): NodePosition[] {
  const tree = parser.parse(query);
  const positions: NodePosition[] = [];
  tree.iterate({
    enter: ({ node }): false | void => {
      if (node.type.id === Selector) {
        positions.push(...getAllPositionsInNodeByType(node, Matcher));
      }
    },
  });
  return positions;
}

export function getIdentifierInStreamPositions(query: string): NodePosition[] {
  const tree = parser.parse(query);
  const positions: NodePosition[] = [];
  tree.iterate({
    enter: ({ node }): false | void => {
      if (node.type.id === Selector) {
        positions.push(...getAllPositionsInNodeByType(node, Identifier));
      }
    },
  });
  return positions;
}
