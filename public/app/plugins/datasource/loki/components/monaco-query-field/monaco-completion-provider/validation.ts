import { SyntaxNode } from '@lezer/common';

import { parser } from '@grafana/lezer-logql';
import { monacoTypes } from '@grafana/ui';
import { ErrorId } from 'app/plugins/datasource/prometheus/querybuilder/shared/parsingUtils';

export function validateQuery(model: monacoTypes.editor.ITextModel) {
  const query = model.getValue();

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

  return errorNodes.map((node: SyntaxNode) => {
    const parent = node.parent || node;
    return {
      startLineNumber: 1,
      startColumn: parent.from,
      endLineNumber: model.getLineCount(),
      endColumn: parent.to,
    };
  });
}
