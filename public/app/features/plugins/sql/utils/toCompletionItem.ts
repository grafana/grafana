import { monacoTypes } from '@grafana/ui';

import { CompletionItemKind, CompletionItemPriority } from '../types';

export const toCompletionItem = (
  value: string,
  range: monacoTypes.IRange,
  rest: Partial<monacoTypes.languages.CompletionItem> = {}
) => {
  const item: monacoTypes.languages.CompletionItem = {
    label: value,
    insertText: value,
    kind: CompletionItemKind.Field,
    sortText: CompletionItemPriority.Medium,
    range,
    ...rest,
  };
  return item;
};
