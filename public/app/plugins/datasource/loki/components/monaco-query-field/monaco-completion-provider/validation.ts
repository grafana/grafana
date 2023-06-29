import { SyntaxNode } from '@lezer/common';

import { parser } from '@grafana/lezer-logql';
import { ErrorId } from 'app/plugins/datasource/prometheus/querybuilder/shared/parsingUtils';

interface ParserErrorBoundary {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  error: string;
}

interface ParseError {
  text: string;
  node: SyntaxNode;
}

/**
 * Conceived to work in combination with the MonacoQueryField component.
 * Given an original query, and it's interpolated version, it will return an array of ParserErrorBoundary
 * objects containing nodes which are actual errors. The interpolated version (even with placeholder variables)
 * is required because variables look like errors for Lezer.
 * @internal
 */
export function validateQuery(
  query: string,
  interpolatedQuery: string,
  queryLines: string[]
): ParserErrorBoundary[] | false {
  if (!query) {
    return false;
  }

  /**
   * To provide support to variable interpolation in query validation, we run the parser in the interpolated
   * query. If there are errors there, we trace them back to the original unparsed query, so we can more
   * accurately highlight the error in the query, since it's likely that the variable name and variable value
   * have different lengths. With this, we also exclude irrelevant parser errors that are produced by
   * lezer not understanding $variables and $__variables, which usually generate 2 or 3 error SyntaxNode.
   */
  const interpolatedErrors: ParseError[] = parseQuery(interpolatedQuery);
  if (!interpolatedErrors.length) {
    return false;
  }

  let parseErrors: ParseError[] = interpolatedErrors;
  if (query !== interpolatedQuery) {
    const queryErrors: ParseError[] = parseQuery(query);
    parseErrors = interpolatedErrors.flatMap(
      (interpolatedError) =>
        queryErrors.filter((queryError) => interpolatedError.text === queryError.text) || interpolatedError
    );
  }

  return parseErrors.map((parseError) => findErrorBoundary(query, queryLines, parseError)).filter(isErrorBoundary);
}

function parseQuery(query: string) {
  const parseErrors: ParseError[] = [];
  const tree = parser.parse(query);
  tree.iterate({
    enter: (nodeRef): false | void => {
      if (nodeRef.type.id === ErrorId) {
        const node = nodeRef.node;
        parseErrors.push({
          node: node,
          text: query.substring(node.from, node.to),
        });
      }
    },
  });
  return parseErrors;
}

function findErrorBoundary(query: string, queryLines: string[], parseError: ParseError): ParserErrorBoundary | null {
  if (queryLines.length === 1) {
    const isEmptyString = parseError.node.from === parseError.node.to;
    const errorNode = isEmptyString && parseError.node.parent ? parseError.node.parent : parseError.node;
    const error = isEmptyString ? query.substring(errorNode.from, errorNode.to) : parseError.text;
    return {
      startLineNumber: 1,
      startColumn: errorNode.from + 1,
      endLineNumber: 1,
      endColumn: errorNode.to + 1,
      error,
    };
  }

  let startPos = 0,
    endPos = 0;
  for (let line = 0; line < queryLines.length; line++) {
    endPos = startPos + queryLines[line].length;

    if (parseError.node.from > endPos) {
      startPos += queryLines[line].length + 1;
      continue;
    }

    return {
      startLineNumber: line + 1,
      startColumn: parseError.node.from - startPos + 1,
      endLineNumber: line + 1,
      endColumn: parseError.node.to - startPos + 1,
      error: parseError.text,
    };
  }

  return null;
}

function isErrorBoundary(boundary: ParserErrorBoundary | null): boundary is ParserErrorBoundary {
  return boundary !== null;
}

export const placeHolderScopedVars = {
  __interval: { text: '1s', value: '1s' },
  __interval_ms: { text: '1000', value: 1000 },
  __range_ms: { text: '1000', value: 1000 },
  __range_s: { text: '1', value: 1 },
  __range: { text: '1s', value: '1s' },
};
