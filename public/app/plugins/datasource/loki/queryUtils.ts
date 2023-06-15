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
  Distinct,
  Range,
} from '@grafana/lezer-logql';
import { DataQuery } from '@grafana/schema';

import { ErrorId } from '../prometheus/querybuilder/shared/parsingUtils';

import { getStreamSelectorPositions } from './modifyQuery';
import { LokiQuery, LokiQueryType } from './types';

export function formatQuery(selector: string | undefined): string {
  return `${selector || ''}`.trim();
}

/**
 * Returns search terms from a LogQL query.
 * E.g., `{} |= foo |=bar != baz` returns `['foo', 'bar']`.
 */
export function getHighlighterExpressionsFromQuery(input: string): string[] {
  const results = [];

  const tree = parser.parse(input);
  const filters: SyntaxNode[] = [];
  tree.iterate({
    enter: ({ type, node }): void => {
      if (type.id === LineFilter) {
        filters.push(node);
      }
    },
  });

  for (let filter of filters) {
    const pipeExact = filter.getChild(Filter)?.getChild(PipeExact);
    const pipeMatch = filter.getChild(Filter)?.getChild(PipeMatch);
    const string = filter.getChild(String);

    if ((!pipeExact && !pipeMatch) || !string) {
      continue;
    }

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
  return results;
}

// we are migrating from `.instant` and `.range` to `.queryType`
// this function returns a new query object that:
// - has `.queryType`
// - does not have `.instant`
// - does not have `.range`
export function getNormalizedLokiQuery(query: LokiQuery): LokiQuery {
  //  if queryType field contains invalid data we behave as if the queryType is empty
  const { queryType } = query;
  const hasValidQueryType =
    queryType === LokiQueryType.Range || queryType === LokiQueryType.Instant || queryType === LokiQueryType.Stream;

  // if queryType exists, it is respected
  if (hasValidQueryType) {
    const { instant, range, ...rest } = query;
    return rest;
  }

  // if no queryType, and instant===true, it's instant
  if (query.instant === true) {
    const { instant, range, ...rest } = query;
    return { ...rest, queryType: LokiQueryType.Instant };
  }

  // otherwise it is range
  const { instant, range, ...rest } = query;
  return { ...rest, queryType: LokiQueryType.Range };
}

const tagsToObscure = ['String', 'Identifier', 'LineComment', 'Number'];
const partsToKeep = ['__error__', '__interval', '__interval_ms'];
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

export function getNodesFromQuery(query: string, nodeTypes: number[]): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];
  const tree = parser.parse(query);
  tree.iterate({
    enter: (node): false | void => {
      if (nodeTypes.includes(node.type.id)) {
        nodes.push(node.node);
      }
    },
  });
  return nodes;
}

export function getNodeFromQuery(query: string, nodeType: number): SyntaxNode | undefined {
  const nodes = getNodesFromQuery(query, [nodeType]);
  return nodes.length > 0 ? nodes[0] : undefined;
}

export function isValidQuery(query: string): boolean {
  return !isQueryWithNode(query, ErrorId);
}

export function isLogsQuery(query: string): boolean {
  return !isQueryWithNode(query, MetricExpr);
}

export function isQueryWithParser(query: string): { queryWithParser: boolean; parserCount: number } {
  const nodes = getNodesFromQuery(query, [LabelParser, JsonExpressionParser]);
  const parserCount = nodes.length;
  return { queryWithParser: parserCount > 0, parserCount };
}

export function getParserFromQuery(query: string): string | undefined {
  const parsers = getNodesFromQuery(query, [LabelParser, JsonExpressionParser]);
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
    return query;
  }
  const selector = query.substring(selectorNode.from, selectorNode.to);

  const pipelineExprNode = getNodeFromQuery(query, PipelineExpr);
  if (!pipelineExprNode) {
    return query;
  }
  const pipelineExpr = query.substring(pipelineExprNode.from, pipelineExprNode.to);

  return `${selector} ${pipelineExpr}`;
}

export function isQueryWithLabelFilter(query: string): boolean {
  return isQueryWithNode(query, LabelFilter);
}

export function isQueryWithLineFilter(query: string): boolean {
  return isQueryWithNode(query, LineFilter);
}

export function isQueryWithDistinct(query: string): boolean {
  return isQueryWithNode(query, Distinct);
}

export function isQueryWithRangeVariable(query: string): boolean {
  let hasRangeVariableDuration = false;
  const tree = parser.parse(query);
  tree.iterate({
    enter: ({ type, from, to }): false | void => {
      if (type.id === Range) {
        if (query.substring(from, to).match(/\[\$__range(_s|_ms)?/)) {
          hasRangeVariableDuration = true;
          return false;
        }
      }
    },
  });
  return hasRangeVariableDuration;
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

export const isLokiQuery = (query: DataQuery): query is LokiQuery => {
  if (!query) {
    return false;
  }

  const lokiQuery = query as LokiQuery;
  return lokiQuery.expr !== undefined;
};

export const getLokiQueryFromDataQuery = (query?: DataQuery): LokiQuery | undefined => {
  if (!query || !isLokiQuery(query)) {
    return undefined;
  }

  return query;
};
