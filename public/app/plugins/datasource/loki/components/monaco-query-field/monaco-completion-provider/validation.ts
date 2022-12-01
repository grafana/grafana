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
  const interpolatedErrorNodes: SyntaxNode[] = [];
  const tree = parser.parse(interpolatedQuery);
  tree.iterate({
    enter: (node): false | void => {
      if (node.type.id === ErrorId) {
        interpolatedErrorNodes.push(node.node);
      }
    },
  });

  if (!interpolatedErrorNodes.length) {
    return false;
  }

  let queryErrorNodes: SyntaxNode[] = [];
  if (query !== interpolatedQuery) {
    const tree = parser.parse(query);
    tree.iterate({
      enter: (node): false | void => {
        if (node.type.id === ErrorId) {
          queryErrorNodes.push(node.node);
        }
      },
    });
  } else {
    queryErrorNodes = interpolatedErrorNodes;
  }

  return interpolatedErrorNodes
    .map((node) => {
      const queryNode = queryErrorNodes.find((queryNode) => queryNode.from === node.from);

      return findErrorBoundary(query, queryLines, queryNode || node);
    })
    .filter(isErrorBoundary);
}

function findErrorBoundary(query: string, queryLines: string[], node: SyntaxNode): ParserErrorBoundary | null {
  if (queryLines.length === 1) {
    const errorNode = node.from === node.to && node.parent ? node.parent : node;
    const error = query.substring(errorNode.from, errorNode.to);
    return {
      startLineNumber: 1,
      startColumn: errorNode.from + 1,
      endLineNumber: 1,
      endColumn: errorNode.to + 1,
      error,
    };
  }

  const error = query.substring(node.from, node.to);

  let startPos = 0,
    endPos = 0;
  for (let line = 0; line < queryLines.length; line++) {
    endPos = startPos + queryLines[line].length;

    if (node.from > endPos) {
      startPos += queryLines[line].length + 1;
      continue;
    }

    return {
      startLineNumber: line + 1,
      startColumn: node.from - startPos + 1,
      endLineNumber: line + 1,
      endColumn: node.to - startPos + 1,
      error,
    };
  }

  return null;
}

function isErrorBoundary(boundary: ParserErrorBoundary | null): boundary is ParserErrorBoundary {
  return boundary !== null;
}
