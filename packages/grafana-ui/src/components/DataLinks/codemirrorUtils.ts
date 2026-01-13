import { autocompletion, Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { DataLinkBuiltInVars, GrafanaTheme2, VariableOrigin, VariableSuggestion } from '@grafana/data';

import { createGenericHighlighter } from '../CodeMirror/highlight';
import { createGenericTheme } from '../CodeMirror/styles';

/**
 * Creates a CodeMirror theme for data link input with custom variable styling
 * This extends the generic theme with data link-specific styles
 */
export function createDataLinkTheme(theme: GrafanaTheme2): Extension {
  const genericTheme = createGenericTheme(theme);

  // Add data link-specific variable styling
  const dataLinkStyles = EditorView.theme({
    '.cm-variable': {
      color: theme.colors.success.text,
      fontWeight: theme.typography.fontWeightMedium,
    },
  });

  return [genericTheme, dataLinkStyles];
}

/**
 * Creates a syntax highlighter for data link variables (${...})
 * Matches the pattern from the old Prism implementation: (\${\S+?})
 */
export function createDataLinkHighlighter(): Extension {
  // Regular expression matching ${...} patterns (same as old implementation)
  const variablePattern = /\$\{[^}]+\}/g;

  return createGenericHighlighter({
    pattern: variablePattern,
    className: 'cm-variable',
  });
}

/**
 * Helper function to generate the apply text for a variable suggestion
 */
function getApplyText(suggestion: VariableSuggestion): string {
  if (suggestion.origin !== VariableOrigin.Template || suggestion.value === DataLinkBuiltInVars.includeVars) {
    return `\${${suggestion.value}}`;
  }
  return `\${${suggestion.value}:queryparam}`;
}

/**
 * Helper function to create a completion option from a suggestion
 */
function createCompletionOption(
  suggestion: VariableSuggestion,
  customApply?: (view: EditorView, completion: Completion, from: number, to: number) => void
): Completion {
  const applyText = getApplyText(suggestion);

  return {
    label: suggestion.label,
    detail: suggestion.origin,
    info: suggestion.documentation,
    apply: customApply ?? applyText,
    type: 'variable',
  };
}

/**
 * Creates autocomplete source function for data link variables
 * Triggers on $ and = characters
 */
export function dataLinkAutocompletion(
  suggestions: VariableSuggestion[]
): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext): CompletionResult | null => {
    // Don't show completions if there are no suggestions
    if (suggestions.length === 0) {
      return null;
    }

    // For explicit completion (Ctrl+Space), show at cursor position
    if (context.explicit) {
      const options = suggestions.map((suggestion) => createCompletionOption(suggestion));
      return {
        from: context.pos,
        options,
      };
    }

    // Match $ or = followed by optional { and word characters
    // This will match: $, ${, ${word, =, etc.
    const word = context.matchBefore(/[$=]\{?[\w.]*$/);

    // If no match on typing, don't show completions
    if (!word) {
      return null;
    }

    // Check if the match starts with a trigger character
    const triggerChar = word.text.charAt(0);
    if (triggerChar !== '$' && triggerChar !== '=') {
      return null;
    }

    // For single trigger character ($ or =), use custom apply function to handle replacement
    const isSingleChar = word.text.length === 1;

    const options = suggestions.map((suggestion) => {
      if (!isSingleChar) {
        return createCompletionOption(suggestion);
      }

      const applyText = getApplyText(suggestion);
      const customApply = (view: EditorView, completion: Completion, from: number, to: number) => {
        // Replace from the trigger character position
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
 * Creates a data link autocompletion extension with configured suggestions
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
