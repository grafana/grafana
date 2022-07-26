import { escapeRegExp } from 'lodash';

import { parser } from '@grafana/lezer-logql';

import { ErrorName } from '../prometheus/querybuilder/shared/parsingUtils';

import { LokiQuery, LokiQueryType } from './types';

export function formatQuery(selector: string | undefined): string {
  return `${selector || ''}`.trim();
}

/**
 * Returns search terms from a LogQL query.
 * E.g., `{} |= foo |=bar != baz` returns `['foo', 'bar']`.
 */
export function getHighlighterExpressionsFromQuery(input: string): string[] {
  let expression = input;
  const results = [];

  // Consume filter expression from left to right
  while (expression) {
    const filterStart = expression.search(/\|=|\|~|!=|!~/);
    // Nothing more to search
    if (filterStart === -1) {
      break;
    }
    // Drop terms for negative filters
    const filterOperator = expression.slice(filterStart, filterStart + 2);
    const skip = expression.slice(filterStart).search(/!=|!~/) === 0;
    expression = expression.slice(filterStart + 2);
    if (skip) {
      continue;
    }
    // Check if there is more chained, by just looking for the next pipe-operator
    const filterEnd = expression.search(/\|/);
    let filterTerm;
    if (filterEnd === -1) {
      filterTerm = expression.trim();
    } else {
      filterTerm = expression.slice(0, filterEnd).trim();
      expression = expression.slice(filterEnd);
    }

    const quotedTerm = filterTerm.match(/"(.*?)"/);
    const backtickedTerm = filterTerm.match(/`(.*?)`/);
    const term = quotedTerm || backtickedTerm;

    if (term) {
      const unwrappedFilterTerm = term[1];
      const regexOperator = filterOperator === '|~';

      let resultTerm = '';

      // Only filter expressions with |~ operator are treated as regular expressions
      if (regexOperator) {
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
    } else {
      return results;
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

export function isValidQuery(query: string): boolean {
  let isValid = true;
  const tree = parser.parse(query);
  tree.iterate({
    enter: (type): false | void => {
      if (type.name === ErrorName) {
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
    enter: (type): false | void => {
      if (type.name === 'MetricExpr') {
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
    enter: (type): false | void => {
      if (type.name === 'LabelParser' || type.name === 'JsonExpressionParser') {
        parserCount++;
      }
    },
  });
  return { queryWithParser: parserCount > 0, parserCount };
}

export function isQueryPipelineErrorFiltering(query: string): boolean {
  let isQueryPipelineErrorFiltering = false;
  const tree = parser.parse(query);
  tree.iterate({
    enter: (type, from, to, get): false | void => {
      if (type.name === 'LabelFilter') {
        const label = get().getChild('Matcher')?.getChild('Identifier');
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
    enter: (type): false | void => {
      if (type.name === 'LabelFormatExpr') {
        queryWithLabelFormat = true;
      }
    },
  });
  return queryWithLabelFormat;
}
