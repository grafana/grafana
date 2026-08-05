import { type VariableSuggestion } from '@grafana/data';
import {
  type CodeMirrorCompletion,
  type CodeMirrorCompletionContext,
  type CodeMirrorCompletionResult,
} from '@grafana/ui/unstable';

// A variable being typed at the cursor: `$`, an optional brace, and the name so far.
const TRIGGER_PATTERN = /\$\{?[\w.]*$/;

const toCompletion = (suggestion: VariableSuggestion): CodeMirrorCompletion => ({
  label: `\${${suggestion.value}}`,
  detail: suggestion.value === suggestion.label ? suggestion.origin : `${suggestion.label} / ${suggestion.origin}`,
  info: suggestion.documentation,
  type: 'variable',
});

/**
 * Autocompletion source for template and field variables, triggered by `$`.
 *
 * Options insert a full `${...}` reference, so the replaced range starts at the
 * `$`. That `${` prefix would defeat CodeMirror's own matching, hence `filter: false`.
 */
export function variableCompletion(
  suggestions: VariableSuggestion[]
): (context: CodeMirrorCompletionContext) => CodeMirrorCompletionResult | null {
  return (context) => {
    const word = context.matchBefore(TRIGGER_PATTERN);
    if (!word) {
      return null;
    }

    const typed = word.text.replace(/^\$\{?/, '').toLowerCase();
    const matches = typed
      ? suggestions.filter((s) => s.value.toLowerCase().includes(typed) || s.label.toLowerCase().includes(typed))
      : suggestions;

    return { from: word.from, options: matches.map(toCompletion), filter: false };
  };
}
