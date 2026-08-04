import { type VariableSuggestion } from '@grafana/data';
import {
  type CodeMirrorCompletion,
  type CodeMirrorCompletionContext,
  type CodeMirrorCompletionResult,
} from '@grafana/ui/unstable';

// A variable being typed at the cursor: `$`, an optional brace, and the name so far.
const TRIGGER_PATTERN = /\$\{?[\w.]*$/;
// The rest of a braced reference the cursor sits inside: any name left to the
// right, then the closing brace.
const BRACED_TAIL_PATTERN = /^[\w.]*\}/;

const toCompletion = (suggestion: VariableSuggestion): CodeMirrorCompletion => ({
  label: `\${${suggestion.value}}`,
  detail: suggestion.value === suggestion.label ? suggestion.origin : `${suggestion.label} / ${suggestion.origin}`,
  info: suggestion.documentation,
  type: 'variable',
});

/** End of the range an option replaces: the cursor, or the end of a braced reference around it. */
function braceAwareTo(context: CodeMirrorCompletionContext, trigger: string): number {
  if (!trigger.startsWith('${')) {
    return context.pos;
  }
  const line = context.state.doc.lineAt(context.pos);
  const tail = context.state.sliceDoc(context.pos, line.to).match(BRACED_TAIL_PATTERN);
  return tail ? context.pos + tail[0].length : context.pos;
}

/**
 * Autocompletion source for template and field variables, triggered by `$`.
 *
 * Options insert a full `${...}` reference, so the replaced range starts at the
 * `$`. That `${` prefix would defeat CodeMirror's own matching, hence `filter: false`.
 *
 * The range also runs past the closing brace of a reference the cursor is inside,
 * because the option carries its own. Typing `${` leaves `${|}` once `closeBrackets`
 * has matched the brace, and that `}` would otherwise be left behind.
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

    return { from: word.from, to: braceAwareTo(context, word.text), options: matches.map(toCompletion), filter: false };
  };
}
