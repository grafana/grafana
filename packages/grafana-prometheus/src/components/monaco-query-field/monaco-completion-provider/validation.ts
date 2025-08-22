// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/loki/components/monaco-query-field/monaco-completion-provider/validation.ts
import { SyntaxNode } from '@lezer/common';
import { LRParser } from '@lezer/lr';

// Although 0 isn't explicitly provided in the @grafana/lezer-logql library as the error node ID, it does appear to be the ID of error nodes within lezer.
const ErrorId = 0;

export const warningTypes: Record<string, string> = {
  SubqueryExpr:
    'This subquery may return only one data point, preventing rate/increase/delta calculations. Use a range at least twice the step size (e.g., [2x:x]).',
};

enum NodeType {
  SubqueryExpr = 'SubqueryExpr',
  Duration = 'NumberDurationLiteralInDurationContext',
}

interface ParserIssueBoundary {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  issue: string;
}

interface ParseIssue {
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
  queryLines: string[],
  parser: LRParser
): { errors: ParserIssueBoundary[]; warnings: ParserIssueBoundary[] } {
  if (!query) {
    return { errors: [], warnings: [] };
  }

  /**
   * To provide support to variable interpolation in query validation, we run the parser in the interpolated
   * query. If there are errors there, we trace them back to the original unparsed query, so we can more
   * accurately highlight the error in the query, since it's likely that the variable name and variable value
   * have different lengths. With this, we also exclude irrelevant parser errors that are produced by
   * lezer not understanding $variables and $__variables, which usually generate 2 or 3 error SyntaxNode.
   */
  const { errors: interpolatedErrors, warnings: interpolatedWarnings } = parseQuery(interpolatedQuery, parser);
  if (!interpolatedErrors.length && !interpolatedWarnings.length) {
    return { errors: [], warnings: [] };
  }

  let parseErrors: ParseIssue[] = interpolatedErrors;
  let parseWarnings: ParseIssue[] = interpolatedWarnings;
  if (query !== interpolatedQuery) {
    const { errors: queryErrors, warnings: queryWarnings } = parseQuery(query, parser);
    parseErrors = interpolatedErrors.flatMap(
      (interpolatedError) =>
        queryErrors.filter((queryError) => interpolatedError.text === queryError.text) || interpolatedError
    );
    parseWarnings = interpolatedWarnings.flatMap(
      (interpolatedWarning) =>
        queryWarnings.filter((queryWarning) => interpolatedWarning.node.from === queryWarning.node.from) ||
        interpolatedWarning
    );
  }

  const errorBoundaries = parseErrors
    .map((parseError) => findIssueBoundary(query, queryLines, parseError, 'error'))
    .filter(isValidIssueBoundary);
  const warningBoundaries = parseWarnings
    .map((parseWarning) => findIssueBoundary(query, queryLines, parseWarning, 'warning'))
    .filter(isValidIssueBoundary);

  return {
    errors: errorBoundaries,
    warnings: warningBoundaries,
  };
}

function parseQuery(query: string, parser: LRParser) {
  const parseErrors: ParseIssue[] = [];
  const parseWarnings: ParseIssue[] = [];

  const tree = parser.parse(query);
  tree.iterate({
    enter: (nodeRef): false | void => {
      if (nodeRef.type.id === ErrorId) {
        const node = nodeRef.node;
        parseErrors.push({ node: node, text: query.substring(node.from, node.to) });
      }

      if (nodeRef.type.name === NodeType.SubqueryExpr) {
        const node = nodeRef.node;
        const durations: string[] = [];

        const children = node.getChildren(NodeType.Duration);
        for (const child of children) {
          durations.push(query.substring(child.from, child.to));
        }

        if (durations.length === 2 && durations[0] === durations[1]) {
          parseWarnings.push({ node: node, text: query.substring(node.from, node.to) });
        }
      }
    },
  });

  return { errors: parseErrors, warnings: parseWarnings };
}

function findIssueBoundary(
  query: string,
  queryLines: string[],
  parseError: ParseIssue,
  issueType: 'error' | 'warning'
): ParserIssueBoundary | null {
  if (queryLines.length === 1) {
    const isEmptyString = parseError.node.from === parseError.node.to;
    const errorNode = isEmptyString && parseError.node.parent ? parseError.node.parent : parseError.node;
    let issue: string;

    if (issueType === 'error') {
      issue = isEmptyString ? query.substring(errorNode.from, errorNode.to) : parseError.text;
    } else {
      issue = warningTypes[parseError.node.type.name];
    }

    return {
      startLineNumber: 1,
      startColumn: errorNode.from + 1,
      endLineNumber: 1,
      endColumn: errorNode.to + 1,
      issue,
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
      issue: issueType === 'error' ? parseError.text : warningTypes[parseError.node.type.name],
    };
  }

  return null;
}

function isValidIssueBoundary(boundary: ParserIssueBoundary | null): boundary is ParserIssueBoundary {
  return boundary !== null;
}

export const placeHolderScopedVars = {
  __interval: { text: '1s', value: '1s' },
  __rate_interval: { text: '1s', value: '1s' },
  __auto: { text: '1s', value: '1s' },
  __interval_ms: { text: '1000', value: 1000 },
  __range_ms: { text: '1000', value: 1000 },
  __range_s: { text: '1', value: 1 },
  __range: { text: '1s', value: '1s' },
};
