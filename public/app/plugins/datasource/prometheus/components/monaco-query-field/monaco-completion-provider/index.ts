import type { Monaco, monacoTypes } from '@grafana/ui';

import { getIntent } from './intent';
import { getCompletions, DataProvider } from './completions';

export function getCompletionProvider(
  monaco: Monaco,
  dataProvider: DataProvider
): monacoTypes.languages.CompletionItemProvider {
  const provideCompletionItems = (
    model: monacoTypes.editor.ITextModel,
    position: monacoTypes.Position
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> => {
    const word = model.getWordAtPosition(position);
    const range =
      word != null
        ? monaco.Range.lift({
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          })
        : monaco.Range.fromPositions(position);
    // documentation says `position` will be "adjusted" in `getOffsetAt`
    // i don't know what that means, to be sure i clone it
    const positionClone = {
      column: position.column,
      lineNumber: position.lineNumber,
    };
    const offset = model.getOffsetAt(positionClone);
    const intent = getIntent(model.getValue(), offset);
    const completionsPromise = intent != null ? getCompletions(intent, dataProvider) : Promise.resolve([]);
    return completionsPromise.then((items) => {
      // monaco by-default alphabetically orders the items.
      // to stop it, we use a number-as-string sortkey,
      // so that monaco keeps the order we use
      const maxIndexDigits = items.length.toString().length;
      const suggestions = items.map((item, index) => ({
        kind: monaco.languages.CompletionItemKind.Text,
        label: item.label,
        insertText: item.insertText,
        sortText: index.toString().padStart(maxIndexDigits, '0'), // to force the order we have
        range,
        command: item.triggerOnInsert
          ? {
              id: 'editor.action.triggerSuggest',
              title: '',
            }
          : undefined,
      }));
      return { suggestions };
    });
  };

  return {
    triggerCharacters: ['{', ',', '[', '(', '='],
    provideCompletionItems,
  };
}
