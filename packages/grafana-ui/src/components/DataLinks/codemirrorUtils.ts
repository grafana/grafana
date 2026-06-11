import { type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

import { DataLinkBuiltInVars, type GrafanaTheme2, VariableOrigin, type VariableSuggestion } from '@grafana/data';

// Matches a complete `${...}` variable reference anywhere in the document.
const VARIABLE_PATTERN = /\$\{[^}]+\}/g;

// Matches a variable being typed at the cursor: a `$`/`=` trigger, an optional
// opening brace, and the variable name typed so far. `=` is the query-param
// separator (`?key=`) — it triggers suggestions but is not part of the variable.
const TRIGGER_PATTERN = /[$=]\{?[\w.]*$/;

const VARIABLE_CLASS = 'cm-variable';

/**
 * Theme contribution for the DataLink variable token. Layered on top of the
 * inline input theme; targets only `.cm-variable`, so it does not compete with
 * the base content color.
 */
export function createDataLinkTheme(theme: GrafanaTheme2): Extension {
  return EditorView.theme({
    [`.${VARIABLE_CLASS}`]: {
      color: theme.colors.success.text,
      fontWeight: `${theme.typography.fontWeightMedium}`,
    },
  });
}

/**
 * Syntax highlighter for `${...}` variable patterns in data link URLs. Mirrors
 * the old Prism `builtInVariable` grammar. Uses a ViewPlugin (not a
 * MatchDecorator) so the global regex's `lastIndex` is reset on every rebuild,
 * avoiding stale state.
 */
export function createDataLinkHighlighter(): Extension {
  const decoration = Decoration.mark({ class: VARIABLE_CLASS });

  const build = (view: EditorView): DecorationSet => {
    const text = view.state.doc.toString();
    const ranges: Array<ReturnType<typeof decoration.range>> = [];

    VARIABLE_PATTERN.lastIndex = 0;
    let match;
    while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
      ranges.push(decoration.range(match.index, match.index + match[0].length));
    }

    return Decoration.set(ranges);
  };

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = build(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations }
  );
}

function getApplyText(suggestion: VariableSuggestion): string {
  if (suggestion.origin !== VariableOrigin.Template || suggestion.value === DataLinkBuiltInVars.includeVars) {
    return `\${${suggestion.value}}`;
  }
  return `\${${suggestion.value}:queryparam}`;
}

function createCompletionOption(suggestion: VariableSuggestion): Completion {
  return {
    label: suggestion.label,
    detail: suggestion.origin,
    info: suggestion.documentation ?? '',
    apply: getApplyText(suggestion),
    type: 'variable',
  };
}

/**
 * Autocompletion source for data link variables, triggered by `$` and `=`.
 *
 * The applied text is always a full `${...}` reference, so the replaced range
 * must start at the right place:
 * - `$`/`${` triggers are part of the variable syntax → replace from the `$`.
 * - `=` is a separator → replace from *after* the `=`, preserving it. (The old
 *   implementation replaced from the `=`, swallowing it for inputs like `=fo`.)
 *
 * Filtering is done here against the typed name (`filter: false`) so the `${`
 * prefix in the replaced range doesn't defeat CodeMirror's label matching.
 */
export function dataLinkAutocompletion(
  suggestions: VariableSuggestion[]
): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext): CompletionResult | null => {
    if (suggestions.length === 0) {
      return null;
    }

    // Explicit trigger (Ctrl+Space): show everything at the cursor.
    if (context.explicit) {
      return {
        from: context.pos,
        options: suggestions.map(createCompletionOption),
        filter: false,
      };
    }

    const word = context.matchBefore(TRIGGER_PATTERN);
    if (!word) {
      return null;
    }

    const triggerChar = word.text.charAt(0);
    // The variable name typed so far, after stripping the trigger and brace.
    const typed = word.text.replace(/^[$=]\{?/, '');
    // `=` is preserved (replace after it); `$`/`${` is replaced (it's re-inserted).
    const from = triggerChar === '=' ? word.from + 1 : word.from;

    const matches = typed
      ? suggestions.filter((s) => s.label.toLowerCase().includes(typed.toLowerCase()))
      : suggestions;

    return {
      from,
      options: matches.map(createCompletionOption),
      filter: false,
    };
  };
}
