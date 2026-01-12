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
 * Creates autocomplete source function for data link variables
 * Triggers on $ and = characters
 */
export function dataLinkAutocompletion(
  suggestions: VariableSuggestion[]
): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext): CompletionResult | null => {
    // Match $ or = followed by optional { and word characters
    // This will match: $, ${, ${word, =, etc.
    const word = context.matchBefore(/[$=]\{?[\w.]*$/);

    // Don't show completions if there are no suggestions
    if (suggestions.length === 0) {
      return null;
    }

    // For explicit completion (Ctrl+Space), show at cursor position
    if (context.explicit) {
      const options: Completion[] = suggestions.map((suggestion) => {
        let applyText: string;

        if (suggestion.origin !== VariableOrigin.Template || suggestion.value === DataLinkBuiltInVars.includeVars) {
          applyText = `\${${suggestion.value}}`;
        } else {
          applyText = `\${${suggestion.value}:queryparam}`;
        }

        return {
          label: suggestion.label,
          detail: suggestion.origin,
          info: suggestion.documentation,
          apply: applyText,
          type: 'variable',
        };
      });

      return {
        from: context.pos,
        options,
      };
    }

    // If no match on typing, don't show completions
    if (!word) {
      return null;
    }

    // Check if the match starts with a trigger character
    const triggerChar = word.text.charAt(0);
    if (triggerChar !== '$' && triggerChar !== '=') {
      return null;
    }

    // For single trigger character ($ or =), start from current position to show completions
    // But the 'apply' text will still replace correctly
    const isSingleChar = word.text.length === 1;

    const options: Completion[] = suggestions.map((suggestion) => {
      // Always insert the full variable syntax
      let applyText: string;

      if (suggestion.origin !== VariableOrigin.Template || suggestion.value === DataLinkBuiltInVars.includeVars) {
        applyText = `\${${suggestion.value}}`;
      } else {
        applyText = `\${${suggestion.value}:queryparam}`;
      }

      return {
        label: suggestion.label,
        detail: suggestion.origin,
        info: suggestion.documentation,
        // Use a custom apply function to handle replacement properly
        apply: isSingleChar
          ? (view, completion, from, to) => {
              // Replace from the trigger character position
              let wordFrom = triggerChar === '=' ? context.pos : word.from;
              view.dispatch({
                changes: { from: wordFrom, to, insert: applyText },
                selection: { anchor: wordFrom + applyText.length }, // Move cursor to end of inserted text
              });
            }
          : applyText,
        type: 'variable',
      };
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
