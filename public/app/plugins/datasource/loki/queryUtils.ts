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
} from '@grafana/lezer-logql';

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

export function isValidQuery(query: string): boolean {
  let isValid = true;
  const tree = parser.parse(query);
  tree.iterate({
    enter: ({ type }): false | void => {
      if (type.id === ErrorId) {
        isValid = false;
      }
    },
  });
  return isValid;
}

export function isLogsQuery(query: string): boolean {
  let isLogsQuery = true;
  const tree = parser.parse(query);
  tree.iterate({
    enter: ({ type }): false | void => {
      if (type.id === MetricExpr) {
        isLogsQuery = false;
      }
    },
  });
  return isLogsQuery;
}

export function isQueryWithParser(query: string): { queryWithParser: boolean; parserCount: number } {
  let parserCount = 0;
  const tree = parser.parse(query);
  tree.iterate({
    enter: ({ type }): false | void => {
      if (type.id === LabelParser || type.id === JsonExpressionParser) {
        parserCount++;
      }
    },
  });
  return { queryWithParser: parserCount > 0, parserCount };
}

export function getParserFromQuery(query: string) {
  const tree = parser.parse(query);
  let logParser;
  tree.iterate({
    enter: (node: SyntaxNode): false | void => {
      if (node.type.id === LabelParser || node.type.id === JsonExpressionParser) {
        logParser = query.substring(node.from, node.to).trim();
        return false;
      }
    },
  });

  return logParser;
}

export function isQueryPipelineErrorFiltering(query: string): boolean {
  let isQueryPipelineErrorFiltering = false;
  const tree = parser.parse(query);
  tree.iterate({
    enter: ({ type, node }): false | void => {
      if (type.id === LabelFilter) {
        const label = node.getChild(Matcher)?.getChild(Identifier);
        if (label) {
          const labelName = query.substring(label.from, label.to);
          if (labelName === '__error__') {
            isQueryPipelineErrorFiltering = true;
          }
        }
      }
    },
  });

  return isQueryPipelineErrorFiltering;
}

export function isQueryWithLabelFormat(query: string): boolean {
  let queryWithLabelFormat = false;
  const tree = parser.parse(query);
  tree.iterate({
    enter: ({ type }): false | void => {
      if (type.id === LabelFormatExpr) {
        queryWithLabelFormat = true;
      }
    },
  });
  return queryWithLabelFormat;
}

export function getLogQueryFromMetricsQuery(query: string): string {
  if (isLogsQuery(query)) {
    return query;
  }

  const tree = parser.parse(query);

  // Log query in metrics query composes of Selector & PipelineExpr
  let selector = '';
  tree.iterate({
    enter: ({ type, from, to }): false | void => {
      if (type.id === Selector) {
        selector = query.substring(from, to);
        return false;
      }
    },
  });

  let pipelineExpr = '';
  tree.iterate({
    enter: ({ type, from, to }): false | void => {
      if (type.id === PipelineExpr) {
        pipelineExpr = query.substring(from, to);
        return false;
      }
    },
  });

  return selector + pipelineExpr;
}

export function isQueryWithLabelFilter(query: string): boolean {
  const tree = parser.parse(query);
  let hasLabelFilter = false;

  tree.iterate({
    enter: ({ type, node }): false | void => {
      if (type.id === LabelFilter) {
        hasLabelFilter = true;
        return;
      }
    },
  });

  return hasLabelFilter;
}

export function isQueryWithLineFilter(query: string): boolean {
  const tree = parser.parse(query);
  let queryWithLineFilter = false;

  tree.iterate({
    enter: ({ type }): false | void => {
      if (type.id === LineFilter) {
        queryWithLineFilter = true;
        return;
      }
    },
  });

  return queryWithLineFilter;
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
