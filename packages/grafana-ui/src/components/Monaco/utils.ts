import type { VariableSuggestion } from '@grafana/data/types';

import { type CodeEditorSuggestionItem, CodeEditorSuggestionItemKind } from './types';

/**
 * @alpha
 */
export function variableSuggestionToCodeEditorSuggestion(sug: VariableSuggestion): CodeEditorSuggestionItem {
  const label = '${' + sug.value + '}';
  const detail = sug.value === sug.label ? sug.origin : `${sug.label} / ${sug.origin}`;

  return {
    label,
    kind: CodeEditorSuggestionItemKind.Property,
    detail,
    documentation: sug.documentation,
  };
}
