import { insertCompletionText } from '@codemirror/autocomplete';
import { type EditorState } from '@codemirror/state';

import { type VariableSuggestion } from '@grafana/data';

import { type CodeMirrorCompletion, type CodeMirrorCompletionContext, type CodeMirrorCompletionResult } from './types';

// The rest of a braced reference the cursor sits inside: the remainder of the
// name, an optional `:format` suffix, then the closing brace.
const BRACED_TAIL_PATTERN = /^[\w.:]*\}/;

/** How a suggestion is presented in the completion list. */
export interface VariableCompletionDisplay {
  label: string;
  detail?: string;
}

export interface VariableCompletionOptions {
  /**
   * Characters besides `$` that open the popup. They are separators rather than
   * part of the reference, so they are preserved: the replaced range starts
   * after them. `['=']` for a URL query string.
   */
  separators?: string[];
  /**
   * Text inserted when an option is accepted. Defaults to `${value}`. Override
   * to add a format suffix, for example `${value:queryparam}` inside a URL.
   */
  getInsertText?: (suggestion: VariableSuggestion) => string;
  /**
   * Label and detail shown in the list. Defaults to the suggestion's own label
   * with its origin as the detail.
   */
  toDisplay?: (suggestion: VariableSuggestion) => VariableCompletionDisplay;
}

type CompletionApply = NonNullable<Exclude<CodeMirrorCompletion['apply'], string>>;

function escapeForCharClass(char: string): string {
  return char.replace(/[\\\]^-]/g, '\\$&');
}

/** `$`, or one of the separators, then an optional brace and the name so far. */
function buildTriggerPattern(separators: string[]): RegExp {
  return new RegExp(`[$${separators.map(escapeForCharClass).join('')}]\\{?[\\w.]*$`);
}

function referenceEnd(state: EditorState, from: number, to: number): number {
  // Only a range that already opened a brace may close one. An unbraced `$name`
  // supplies both braces itself, so a `}` further along the line is not ours.
  if (!state.sliceDoc(from, to).startsWith('${')) {
    return to;
  }

  const line = state.doc.lineAt(to);
  const tail = state.sliceDoc(to, line.to).match(BRACED_TAIL_PATTERN);
  return tail ? to + tail[0].length : to;
}

/**
 * `Completion.apply` for an option that inserts a whole `${...}` reference.
 *
 * The option carries its own closing brace, so a `}` already to the right of the
 * cursor has to be part of the replaced range. Two ways one gets there:
 * - `closeBrackets`, on in CodeMirror's default basic setup, inserts `}` the
 *   moment `{` is typed, leaving the document as `${|}`.
 * - The cursor sits inside a reference that is already complete: `${my|Var}`.
 *
 * Prefer {@link createVariableCompletionSource}. Reach for this directly only
 * when a source has to emit variable options alongside other kinds, where a
 * range on the result would apply to every option.
 */
export function applyVariableReference(text: string): CompletionApply {
  return (view, _completion, from, to) => {
    view.dispatch(insertCompletionText(view.state, text, from, referenceEnd(view.state, from, to)));
  };
}

/**
 * Autocompletion source for Grafana variables, triggered by `$`.
 *
 * Options insert a full `${...}` reference, so the replaced range starts at the
 * `$`. That `${` prefix would defeat CodeMirror's own label matching, so
 * suggestions are filtered here instead and the result sets `filter: false`.
 */
export function createVariableCompletionSource(
  suggestions: VariableSuggestion[],
  options: VariableCompletionOptions = {}
): (context: CodeMirrorCompletionContext) => CodeMirrorCompletionResult | null {
  const {
    separators = [],
    getInsertText = (suggestion: VariableSuggestion) => `\${${suggestion.value}}`,
    toDisplay = (suggestion: VariableSuggestion) => ({ label: suggestion.label, detail: suggestion.origin }),
  } = options;
  const triggerPattern = buildTriggerPattern(separators);

  const toCompletion = (suggestion: VariableSuggestion): CodeMirrorCompletion => ({
    ...toDisplay(suggestion),
    info: suggestion.documentation,
    apply: applyVariableReference(getInsertText(suggestion)),
    type: 'variable',
  });

  return (context: CodeMirrorCompletionContext): CodeMirrorCompletionResult | null => {
    if (suggestions.length === 0) {
      return null;
    }

    const word = context.matchBefore(triggerPattern);

    // Outside a reference, only an explicit request (Ctrl+Space) responds, by
    // inserting a fresh reference at the cursor.
    if (!word) {
      return context.explicit ? { from: context.pos, options: suggestions.map(toCompletion), filter: false } : null;
    }

    // A separator is preserved, so the range starts after it. A `$` is part of
    // the reference and is replaced, which is what stops an explicit request
    // after a typed `$` from producing `$${...}`.
    const from = separators.includes(word.text.charAt(0)) ? word.from + 1 : word.from;
    const typed = word.text.slice(1).replace(/^\{/, '').toLowerCase();

    // An explicit request shows every variable; implicit triggering filters by
    // the name typed so far.
    const matches =
      context.explicit || !typed
        ? suggestions
        : suggestions.filter((s) => s.value.toLowerCase().includes(typed) || s.label.toLowerCase().includes(typed));

    return { from, options: matches.map(toCompletion), filter: false };
  };
}
