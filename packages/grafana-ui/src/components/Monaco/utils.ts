import { VariableSuggestion, InterpolateFunction } from '@grafana/data';
import { CodeEditorSuggestionItem, CodeEditorSuggestionItemKind } from './types';

/**
 * @experimental
 */
export function variableSuggestionToCodeEditorSuggestion(
  sug: VariableSuggestion,
  replace: InterpolateFunction
): CodeEditorSuggestionItem {
  const detail = sug.label + ' ' + replace(sug.value);

  return {
    label: sug.value,
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
