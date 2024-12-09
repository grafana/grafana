import { SyntaxNode } from '@lezer/common';
import { escapeRegExp } from 'lodash';

import {
  parser,
  LineFilter,
  PipeExact,
  PipeMatch,
  Filter,
  String,
  LabelFormatExpr,
  Selector,
  PipelineExpr,
  LabelParser,
  JsonExpressionParser,
  LabelFilter,
  MetricExpr,
  Matcher,
  Identifier,
  Range,
  Logfmt,
  Json,
  OrFilter,
  FilterOp,
  RangeOp,
  VectorOp,
  BinOpExpr,
} from '@grafana/lezer-logql';
import { DataQuery } from '@grafana/schema';

import { addDropToQuery, addLabelToQuery, getStreamSelectorPositions, NodePosition } from './modifyQuery';
import { ErrorId } from './querybuilder/parsingUtils';
import { LabelType, LokiQuery, LokiQueryDirection, LokiQueryType } from './types';

/**
 * Returns search terms from a LogQL query.
 * E.g., `{} |= "foo" |= "bar" != "baz"` returns `['foo', 'bar']`.
 */
export function getHighlighterExpressionsFromQuery(input = ''): string[] {
  const results: string[] = [];

  const filters = getNodesFromQuery(input, [LineFilter]);

  for (const filter of filters) {
    const pipeExact = filter.getChild(Filter)?.getChild(PipeExact);
    const pipeMatch = filter.getChild(Filter)?.getChild(PipeMatch);
    const strings = getStringsFromLineFilter(filter);

    if ((!pipeExact && !pipeMatch) || !strings.length) {
      continue;
    }

    for (const string of strings) {
      const filterTerm = input.substring(string.from, string.to).trim();
      const backtickedTerm = filterTerm[0] === '`';
      const unwrappedFilterTerm = filterTerm.substring(1, filterTerm.length - 1);

      if (!unwrappedFilterTerm) {
        continue;
      }

      let resultTerm = '';

      // Only filter expressions with |~ operator are treated as regular expressions
      if (pipeMatch) {
        // When using backticks, Loki doesn't require to escape special characters and we can just push regular expression to highlights array
        // When using quotes, we have extra backslash escaping and we need to replace \\ with \
        resultTerm = backtickedTerm ? unwrappedFilterTerm : unwrappedFilterTerm.replace(/\\\\/g, '\\');
      } else {
        // We need to escape this string so it is not matched as regular expression
        resultTerm = escapeRegExp(unwrappedFilterTerm);
      }

      if (resultTerm) {
        results.push(resultTerm);
      }
    }
  }
  return results;
}

export function getExpressionFromExecutedQuery(executedQueryString: string) {
  return executedQueryString.replace('Expr: ', '');
}

export function getStringsFromLineFilter(filter: SyntaxNode): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];
  let node: SyntaxNode | null = filter;
  do {
    const string = node.getChild(String);
    if (string && !node.getChild(FilterOp)) {
      nodes.push(string);
    }
    node = node.getChild(OrFilter);
  } while (node != null);

  return nodes;
}

export function getNormalizedLokiQuery(query: LokiQuery): LokiQuery {
  let queryType = getLokiQueryType(query);
  // instant and range are deprecated, we want to remove them
  const { instant, range, ...rest } = query;

  // if `query.expr` is not parsable this might throw an error
  try {
    if (isLogsQuery(query.expr) && queryType === LokiQueryType.Instant) {
      queryType = LokiQueryType.Range;
    }
  } catch (e) {}
  return { ...rest, queryType };
}

export function getLokiQueryType(query: LokiQuery): LokiQueryType {
  // we are migrating from `.instant` and `.range` to `.queryType`
  // this function returns the correct query type
  const { queryType } = query;
  const hasValidQueryType =
    queryType === LokiQueryType.Range || queryType === LokiQueryType.Instant || queryType === LokiQueryType.Stream;

  // if queryType exists, it is respected
  if (hasValidQueryType) {
    return queryType;
  }

  // if no queryType, and instant===true, it's instant
  if (query.instant === true) {
    return LokiQueryType.Instant;
  }

  // otherwise it is range
  return LokiQueryType.Range;
}

const tagsToObscure = ['String', 'Identifier', 'LineComment', 'Number'];
const partsToKeep = ['__error__', '__interval', '__interval_ms', '__auto'];
export function obfuscate(query: string): string {
  let obfuscatedQuery: string = query;
  const tree = parser.parse(query);
  tree.iterate({
    enter: ({ name, from, to }): false | void => {
      const queryPart = query.substring(from, to);
      if (tagsToObscure.includes(name) && !partsToKeep.includes(queryPart)) {
        obfuscatedQuery = obfuscatedQuery.replace(queryPart, name);
      }
    },
  });
  return obfuscatedQuery;
}

export function parseToNodeNamesArray(query: string): string[] {
  const queryParts: string[] = [];
  const tree = parser.parse(query);
  tree.iterate({
    enter: ({ name }): false | void => {
      queryParts.push(name);
    },
  });
  return queryParts;
}

export function isQueryWithNode(query: string, nodeType: number): boolean {
  let isQueryWithNode = false;
  const tree = parser.parse(query);
  tree.iterate({
    enter: ({ type }): false | void => {
      if (type.id === nodeType) {
        isQueryWithNode = true;
        return false;
      }
    },
  });
  return isQueryWithNode;
}

export function getNodesFromQuery(query: string, nodeTypes?: number[]): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];
  const tree = parser.parse(query);
  tree.iterate({
    enter: (node): false | void => {
      if (nodeTypes === undefined || nodeTypes.includes(node.type.id)) {
        nodes.push(node.node);
      }
    },
  });
  return nodes;
}

export function getNodePositionsFromQuery(query: string, nodeTypes?: number[]): NodePosition[] {
  const positions: NodePosition[] = [];
  const tree = parser.parse(query);
  tree.iterate({
    enter: (node): false | void => {
      if (nodeTypes === undefined || nodeTypes.includes(node.type.id)) {
        positions.push(NodePosition.fromNode(node.node));
      }
    },
  });
  return positions;
}

export function getNodeFromQuery(query: string, nodeType: number): SyntaxNode | undefined {
  const nodes = getNodesFromQuery(query, [nodeType]);
  return nodes.length > 0 ? nodes[0] : undefined;
}

/**
 * Parses the query and looks for error nodes. If there is at least one, it returns true.
 * Grafana variables are considered errors, so if you need to validate a query
 * with variables you should interpolate it first.
 */
export function isQueryWithError(query: string): boolean {
  return isQueryWithNode(query, ErrorId);
}

export function isLogsQuery(query: string): boolean {
  // As a safeguard we are checking for a length of 2, because at least the query should be `{}`
  return query.trim().length > 2 && !isQueryWithNode(query, MetricExpr);
}

export function isQueryWithParser(query: string): { queryWithParser: boolean; parserCount: number } {
  const nodes = getNodesFromQuery(query, [LabelParser, JsonExpressionParser, Logfmt]);
  const parserCount = nodes.length;
  return { queryWithParser: parserCount > 0, parserCount };
}

export function getParserFromQuery(query: string): string | undefined {
  const parsers = getNodesFromQuery(query, [LabelParser, Json, Logfmt]);
  return parsers.length > 0 ? query.substring(parsers[0].from, parsers[0].to).trim() : undefined;
}

export function isQueryPipelineErrorFiltering(query: string): boolean {
  const labels = getNodesFromQuery(query, [LabelFilter]);
  for (const node of labels) {
    const label = node.getChild(Matcher)?.getChild(Identifier);
    if (label) {
      const labelName = query.substring(label.from, label.to);
      if (labelName === '__error__') {
        return true;
      }
    }
  }
  return false;
}

export function isQueryWithLabelFormat(query: string): boolean {
  return isQueryWithNode(query, LabelFormatExpr);
}

export function getLogQueryFromMetricsQuery(query: string): string {
  if (isLogsQuery(query)) {
    return query;
  }

  // Log query in metrics query composes of Selector & PipelineExpr
  const selectorNode = getNodeFromQuery(query, Selector);
  if (!selectorNode) {
    return '';
  }
  const selector = query.substring(selectorNode.from, selectorNode.to);

  const pipelineExprNode = getNodeFromQuery(query, PipelineExpr);
  const pipelineExpr = pipelineExprNode ? query.substring(pipelineExprNode.from, pipelineExprNode.to) : '';

  return `${selector} ${pipelineExpr}`.trim();
}

export function getLogQueryFromMetricsQueryAtPosition(query: string, position: number): string {
  if (isLogsQuery(query)) {
    return query;
  }

  const metricQuery = getNodesFromQuery(query, [MetricExpr])
    .reverse() // So we don't get the root metric node
    .find((node) => node.from <= position && node.to >= position);
  if (!metricQuery) {
    return '';
  }
  return getLogQueryFromMetricsQuery(query.substring(metricQuery.from, metricQuery.to));
}

export function isQueryWithLabelFilter(query: string): boolean {
  return isQueryWithNode(query, LabelFilter);
}

export function isQueryWithLineFilter(query: string): boolean {
  return isQueryWithNode(query, LineFilter);
}

export function isQueryWithRangeVariable(query: string): boolean {
  const rangeNodes = getNodesFromQuery(query, [Range]);
  for (const node of rangeNodes) {
    if (query.substring(node.from, node.to).match(/\[\$__range(_s|_ms)?/)) {
      return true;
    }
  }
  return false;
}

export function getStreamSelectorsFromQuery(query: string): string[] {
  const labelMatcherPositions = getStreamSelectorPositions(query);

  const labelMatchers = labelMatcherPositions.map((labelMatcher) => {
    return query.slice(labelMatcher.from, labelMatcher.to);
  });

  return labelMatchers;
}

export function requestSupportsSplitting(allQueries: LokiQuery[]) {
  const queries = allQueries
    .filter((query) => !query.hide)
    .filter((query) => !query.refId.includes('do-not-chunk'))
    .filter((query) => query.expr);

  return queries.length > 0;
}

export function requestSupportsSharding(allQueries: LokiQuery[]) {
  const queries = allQueries
    .filter((query) => !query.hide)
    .filter((query) => query.queryType !== LokiQueryType.Instant)
    .filter((query) => !query.refId.includes('do-not-shard'))
    .filter((query) => query.expr)
    .filter(
      (query) =>
        (query.direction === LokiQueryDirection.Scan && isLogsQuery(query.expr)) || metricSupportsSharding(query.expr)
    );

  return queries.length > 0;
}

function metricSupportsSharding(query: string) {
  if (isLogsQuery(query)) {
    return false;
  }
  query = query.trim().toLowerCase();

  const disallowed = getNodesFromQuery(query, [BinOpExpr]);
  if (disallowed.length > 0) {
    return false;
  }

  /**
   * If there are VectorAggregationExpr, we want to make sure that the leftmost VectorOp is sum, meaning that
   * it's wrapped in a sum. E.g.
   * Disallowed: avg(sum by (level) (avg_over_time({place="luna"}[1m])))
   * Allowed: sum(sum by (level) (avg_over_time({place="luna"}[1m])))
   */
  const vectorOps = getNodesFromQuery(query, [VectorOp]);
  const supportedVectorOps = vectorOps.filter((node) => getNodeString(query, node) === 'sum');
  const unsupportedVectorOps = vectorOps.filter((node) => getNodeString(query, node) !== 'sum');
  const supportedWrappingVectorOpps = supportedVectorOps.filter((supportedOp) =>
    unsupportedVectorOps.every((unsupportedOp) => supportedOp.from < unsupportedOp.from)
  );
  if (unsupportedVectorOps.length > 0) {
    return supportedWrappingVectorOpps.length > 0;
  }

  const rangeOps = getNodesFromQuery(query, [RangeOp]);
  const supportedRangeOps = ['count_over_time', 'sum_over_time', 'bytes_over_time'];
  for (const node of rangeOps) {
    if (!supportedRangeOps.includes(getNodeString(query, node))) {
      return supportedWrappingVectorOpps.length > 0;
    }
  }

  return true;
}

function getNodeString(query: string, node: SyntaxNode) {
  return query.substring(node.from, node.to);
}

export const isLokiQuery = (query: DataQuery): query is LokiQuery => {
  if (!query) {
    return false;
  }

  return 'expr' in query && query.expr !== undefined;
};

export const getLokiQueryFromDataQuery = (query?: DataQuery): LokiQuery | undefined => {
  if (!query || !isLokiQuery(query)) {
    return undefined;
  }

  return query;
};

export const interpolateShardingSelector = (queries: LokiQuery[], shards: number[]) => {
  if (shards.length === 0) {
    return queries;
  }

  let shardValue = shards.join('|');

  // -1 means empty shard value
  if (shardValue === '-1' || shards.length === 1) {
    shardValue = shardValue === '-1' ? '' : shardValue;
    return queries.map((query) => ({
      ...query,
      expr: addStreamShardLabelsToQuery(query.expr, '=', shardValue),
    }));
  }

  return queries.map((query) => ({
    ...query,
    expr: addStreamShardLabelsToQuery(query.expr, '=~', shardValue),
  }));
};

function addStreamShardLabelsToQuery(query: string, operator: string, shardValue: string) {
  const shardedQuery = addLabelToQuery(query, '__stream_shard__', operator, shardValue, LabelType.Indexed);
  if (!isLogsQuery(query)) {
    return addDropToQuery(shardedQuery, ['__stream_shard__']);
  }
  return shardedQuery;
}

export const getSelectorForShardValues = (query: string) => {
  const selector = getNodesFromQuery(query, [Selector]);
  if (selector.length > 0) {
    return query.substring(selector[0].from, selector[0].to);
  }
  return '';
};
