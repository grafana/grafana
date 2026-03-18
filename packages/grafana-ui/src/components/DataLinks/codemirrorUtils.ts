import { autocompletion, Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { DataLinkBuiltInVars, GrafanaTheme2, VariableOrigin, VariableSuggestion } from '@grafana/data';

import { createGenericHighlighter } from '../CodeMirror/highlight';
import { createGenericTheme } from '../CodeMirror/styles';

/**
 * CodeMirror theme for data link input.  Extends the generic theme with
 * variable-specific styling (success color + medium weight).
 */
export function createDataLinkTheme(theme: GrafanaTheme2): Extension {
  const genericTheme = createGenericTheme(theme);

  const dataLinkStyles = EditorView.theme({
    '.cm-variable': {
      color: theme.colors.success.text,
      fontWeight: theme.typography.fontWeightMedium,
    },
  });

  return [genericTheme, dataLinkStyles];
}

/**
 * Syntax highlighter for `${...}` variable patterns in data link URLs.
 * Pattern mirrors the old Prism `builtInVariable` syntax: /\${\S+?}/.
 */
export function createDataLinkHighlighter(): Extension {
  return createGenericHighlighter({
    pattern: /\$\{[^}]+\}/g,
    className: 'cm-variable',
  });
}

function getApplyText(suggestion: VariableSuggestion): string {
  if (suggestion.origin !== VariableOrigin.Template || suggestion.value === DataLinkBuiltInVars.includeVars) {
    return `\${${suggestion.value}}`;
  }
  return `\${${suggestion.value}:queryparam}`;
}

function createCompletionOption(
  suggestion: VariableSuggestion,
  customApply?: (view: EditorView, completion: Completion, from: number, to: number) => void
): Completion {
  const applyText = getApplyText(suggestion);

  return {
    label: suggestion.label,
    detail: suggestion.origin,
    info: suggestion.documentation ?? '',
    apply: customApply ?? applyText,
    type: 'variable',
  };
}

/**
 * Autocompletion source that triggers on `$` and `=` characters.
 */
export function dataLinkAutocompletion(
  suggestions: VariableSuggestion[]
): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext): CompletionResult | null => {
    if (suggestions.length === 0) {
      return null;
    }

    // Explicit trigger (Ctrl+Space) — show all at cursor position
    if (context.explicit) {
      return {
        from: context.pos,
        options: suggestions.map((s) => createCompletionOption(s)),
      };
    }

    // Match $ or = followed by optional { and word characters
    const word = context.matchBefore(/[$=]\{?[\w.]*$/);
    if (!word) {
      return null;
    }

    const triggerChar = word.text.charAt(0);
    if (triggerChar !== '$' && triggerChar !== '=') {
      return null;
    }

    const isSingleChar = word.text.length === 1;

    const options = suggestions.map((suggestion) => {
      if (!isSingleChar) {
        return createCompletionOption(suggestion);
      }

      const applyText = getApplyText(suggestion);
      const customApply = (view: EditorView, _completion: Completion, _from: number, to: number) => {
        // Replace from the trigger character position (not after =, replace from $ pos)
        const wordFrom = triggerChar === '=' ? context.pos : word.from;
        view.dispatch({
          changes: { from: wordFrom, to, insert: applyText },
          selection: { anchor: wordFrom + applyText.length },
        });
      };

      return createCompletionOption(suggestion, customApply);
    });

    return {
      from: isSingleChar ? context.pos : word.from,
      options,
    };
  };
}

/**
 * Creates the full autocompletion Extension for data link input.
 * CodeMirror's `defaultKeymap: true` handles Enter/Tab/Escape/Arrow natively,
 * eliminating the manual onKeyDown logic from the old Slate implementation.
 */
export function createDataLinkAutocompletion(suggestions: VariableSuggestion[]): Extension {
  return autocompletion({
    override: [dataLinkAutocompletion(suggestions)],
    activateOnTyping: true,
    closeOnBlur: true,
    maxRenderedOptions: 100,
    defaultKeymap: true,
    interactionDelay: 0,
  });
}
