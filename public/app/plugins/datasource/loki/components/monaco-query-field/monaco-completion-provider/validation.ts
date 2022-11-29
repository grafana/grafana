import { SyntaxNode } from '@lezer/common';

import { parser } from '@grafana/lezer-logql';
import { monacoTypes } from '@grafana/ui';
import { ErrorId } from 'app/plugins/datasource/prometheus/querybuilder/shared/parsingUtils';

interface ParserErrorBoundary {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

function isErrorBoundary(boundary: ParserErrorBoundary | null): boundary is ParserErrorBoundary {
  return boundary !== null;
}

export function validateQuery(model: monacoTypes.editor.ITextModel): ParserErrorBoundary[] | false {
  const query = model.getValue();
  const lines = model.getLinesContent();

  if (!query) {
    return false;
  }

  const errorNodes: SyntaxNode[] = [];

  const tree = parser.parse(query);
  tree.iterate({
    enter: (node): false | void => {
      if (node.type.id === ErrorId) {
        errorNodes.push(node.node);
      }
    },
  });

  if (!errorNodes.length) {
    return false;
  }

  return errorNodes.map((node) => findErrorBoundary(query, lines, node)).filter(isErrorBoundary);
}

function findErrorBoundary(query: string, queryLines: string[], node: SyntaxNode): ParserErrorBoundary | null {
  if (queryLines.length === 1) {
    return {
      startLineNumber: 1,
      startColumn: node.from,
      endLineNumber: 1,
      endColumn: node.to,
    };
  }

  const errorNode = node.from === node.to && node.parent ? node.parent : node;

  let startPos = 0,
    endPos = 0;
  for (let line = 0; line < queryLines.length; line++) {
    endPos = startPos + queryLines[line].length;

    if (errorNode.from > endPos) {
      startPos += queryLines[line].length + 1;
      continue;
    }

    return {
      startLineNumber: line + 1,
      startColumn: errorNode.from - startPos + 1,
      endLineNumber: line + 1,
      endColumn: errorNode.to - startPos + 1,
    };
  }

  return null;
}
