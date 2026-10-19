import { type VariableSuggestion } from '@grafana/data';
import { type CodeMirrorCompletionContext, type CodeMirrorCompletionResult } from '@grafana/ui';
import { createVariableCompletionSource } from '@grafana/ui/codemirror';

/**
 * Autocompletion source for template and field variables, triggered by `$`.
 *
 * Options are labelled with the reference they insert rather than with the bare
 * variable name, so the list shows exactly what will land in the document.
 */
export function variableCompletion(
  suggestions: VariableSuggestion[]
): (context: CodeMirrorCompletionContext) => CodeMirrorCompletionResult | null {
  return createVariableCompletionSource(suggestions, {
    toDisplay: (suggestion) => ({
      label: `\${${suggestion.value}}`,
      detail: suggestion.value === suggestion.label ? suggestion.origin : `${suggestion.label} / ${suggestion.origin}`,
    }),
  });
}
