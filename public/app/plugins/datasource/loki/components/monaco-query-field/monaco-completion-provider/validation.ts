import { SyntaxNode } from '@lezer/common';
import { Token } from 'prismjs';

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

export function highlightErrorsInQuery(query: string, interpolatedQuery: string): string {
  const errorBoundaries = mergeErrors(validateQuery(query, interpolatedQuery, query.split('\n')));

  if (!errorBoundaries) {
    return query;
  }

  const queryLines = query.split('\n');
  const queryWithErrors = queryLines.map((line, index) => {
    let updatedLine = line;
    errorBoundaries.forEach((errorBoundary) => {
      if (errorBoundary.startLineNumber !== index + 1) {
        return;
      }
      const { startColumn, endColumn, error } = errorBoundary;
      const delta = updatedLine.length - line.length;

      updatedLine = `${updatedLine.substring(0, startColumn - 1 + delta)}%err${error}err%${updatedLine.substring(
        endColumn - 1 + delta
      )}`;
    });
    return updatedLine;
  });

  return queryWithErrors.join('\n');
}

function mergeErrors(errorBoundaries: ParserErrorBoundary[] | false): ParserErrorBoundary[] | false {
  if (!errorBoundaries) {
    return false;
  }

  errorBoundaries.sort((a, b) => a.startColumn - b.startColumn);

  const mergedErrors = [];
  for (const error of errorBoundaries) {
    if (mergedErrors.length === 0 || error.startColumn > mergedErrors[mergedErrors.length - 1].endColumn) {
      mergedErrors.push(error);
    } else if (error.endColumn > mergedErrors[mergedErrors.length - 1].endColumn) {
      mergedErrors[mergedErrors.length - 1] = error;
    }
  }

  return mergedErrors;
}

function tokenContainsString(token: Token | string, string: string): boolean {
  if (typeof token === 'string') {
    return token.includes(string);
  } else if (Array.isArray(token.content)) {
    return token.content.some(isErrorStartToken);
  } else if (typeof token.content === 'string') {
    return tokenContainsString(token.content, string);
  }
  return false;
}

function isErrorStartToken(token: Token | string) {
  return tokenContainsString(token, '%err');
}

function isErrorEndToken(token: Token | string) {
  return tokenContainsString(token, 'err%');
}

function clearErrorToken(token: Token | string) {
  if (typeof token === 'string') {
    return token.replace(/%err|err%/g, '');
  } else if (Array.isArray(token.content)) {
    token.content = token.content.map((content) => clearErrorToken(content));
  } else if (typeof token.content === 'string') {
    token.content = clearErrorToken(token.content);
  }
  return token;
}

export function processErrorTokens(tokens: Array<Token | string>) {
  let errorZone = false;
  return tokens.map((token: string | Token) => {
    if (errorZone) {
      token = typeof token === 'string' ? new Token('error', token) : token;
      token.type = 'error';
    } else if (isErrorStartToken(token)) {
      errorZone = true;
      token = typeof token === 'string' ? new Token('error', token) : token;
    } else if (isErrorEndToken(token)) {
      errorZone = false;
    }

    return clearErrorToken(token);
  });
}
