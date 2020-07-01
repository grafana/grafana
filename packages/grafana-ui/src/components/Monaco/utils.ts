import { VariableSuggestion, InterpolateFunction } from '@grafana/data';
import { CodeEditorSuggestionItem, CodeEditorSuggestionItemKind } from './types';

/**
 * @experimental
 */
export function variableSuggestionToCodeEditorSuggestion(
  sug: VariableSuggestion,
  replace: InterpolateFunction
): CodeEditorSuggestionItem {
  const label = '${' + sug.value + '}';
  const escaped = replace(label);
  let detail = sug.label;
  if (label !== escaped) {
    detail += ': ' + escaped;
  }

  return {
    label,
    kind: CodeEditorSuggestionItemKind.Property,
    detail,
    documentation: sug.documentation,
  };
}

// export enum VariableOrigin {
//     Series = 'series',
//     Field = 'field',
//     Fields = 'fields',
//     Value = 'value',
//     BuiltIn = 'built-in',
//     Template = 'template',
//   }

//   export interface  {
//     value: string;
//     label: string;
//     documentation?: string;
//     origin: VariableOrigin;
//   }
