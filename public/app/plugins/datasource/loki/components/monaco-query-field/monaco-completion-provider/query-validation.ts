import { SyntaxNode } from '@lezer/common';

import { parser } from '@grafana/lezer-logql';
import { monacoTypes } from '@grafana/ui';
import { ErrorId } from 'app/plugins/datasource/prometheus/querybuilder/shared/parsingUtils';

export function validate(model: monacoTypes.editor.ITextModel) {
  const query = model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: model.getLineCount(),
    endColumn: model.getLineLength(model.getLineCount()) + 1,
  });

  if (!query) {
    return false;
  }

  let errorNode: SyntaxNode | undefined = undefined;

  const tree = parser.parse(query);
  tree.iterate({
    enter: (node): false | void => {
      if (node.type.id === ErrorId) {
        errorNode = node.node;
        return;
      }
    },
  });

  if (!errorNode) {
    return false;
  }

  const parent = errorNode.parent;
  return [
    {
      startLineNumber: 1,
      startColumn: parent.from,
      endLineNumber: parent.to,
      endColumn: model.getLineLength(model.getLineCount()) + 1,
    },
  ];
}
