import { type VariableSuggestion } from '@grafana/data';
import {
  type CodeMirrorCompletionContext,
  type CodeMirrorCompletionResult,
  createVariableCompletionSource,
} from '@grafana/ui/unstable';

import { getMacroReducers } from '../reducerMacros';

// The reducer id typed so far, after `:reduce:` in a data macro.
const REDUCER_ID_BEFORE_CURSOR = /(?<=\$\{__data[^}]*:reduce:)\w*$/;

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

/** Autocompletion for the reducer in `${__data.fields.x:reduce:<id>}`. Replaces only the id. */
export function reducerCompletion(context: CodeMirrorCompletionContext): CodeMirrorCompletionResult | null {
  const match = context.matchBefore(REDUCER_ID_BEFORE_CURSOR);
  if (!match) {
    return null;
  }

  return {
    from: match.from,
    options: getMacroReducers().map((reducer) => ({
      label: reducer.id,
      detail: reducer.name,
      info: reducer.description,
      type: 'enum',
    })),
    validFor: /^\w*$/,
  };
}
