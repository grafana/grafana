import { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

import { DataLinkBuiltInVars, GrafanaTheme2, VariableOrigin, VariableSuggestion } from '@grafana/data';

/**
 * Creates a CodeMirror theme for data link input based on Grafana's theme
 */
export function createDataLinkTheme(theme: GrafanaTheme2): Extension {
  const isDark = theme.colors.mode === 'dark';

  return EditorView.theme(
    {
      '&': {
        fontSize: theme.typography.body.fontSize,
        fontFamily: theme.typography.fontFamilyMonospace,
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
      },
      '.cm-placeholder': {
        color: theme.colors.text.disabled,
        fontStyle: 'normal',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: theme.typography.fontFamilyMonospace,
      },
      '.cm-content': {
        padding: '3px 0',
        color: theme.colors.text.primary,
        caretColor: theme.colors.text.primary,
      },
      '.cm-line': {
        padding: '0 2px',
      },
      '.cm-cursor': {
        borderLeftColor: theme.colors.text.primary,
      },
      '.cm-selectionBackground': {
        backgroundColor: `${theme.colors.action.selected} !important`,
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: `${theme.colors.action.focus} !important`,
      },
      '.cm-variable': {
        color: theme.colors.success.text,
        fontWeight: theme.typography.fontWeightMedium,
      },
      '.cm-activeLine': {
        backgroundColor: 'transparent',
      },
      '.cm-gutters': {
        display: 'none',
      },
      '.cm-tooltip': {
        zIndex: theme.zIndex.portal + 1, // Above modals and portals (1062)
      },
      '.cm-tooltip.cm-tooltip-autocomplete': {
        backgroundColor: theme.colors.background.primary,
        border: `1px solid ${theme.colors.border.weak}`,
        boxShadow: theme.shadows.z3,
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul': {
        fontFamily: theme.typography.fontFamily,
        maxHeight: '300px',
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
        padding: '2px 8px',
        color: theme.colors.text.primary,
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: theme.colors.background.secondary,
        color: theme.colors.text.primary,
      },
      '.cm-completionLabel': {
        fontFamily: theme.typography.fontFamilyMonospace,
        fontSize: theme.typography.size.sm,
      },
      '.cm-completionDetail': {
        color: theme.colors.text.secondary,
        fontStyle: 'normal',
        marginLeft: theme.spacing(1),
      },
      '.cm-completionInfo': {
        backgroundColor: theme.colors.background.primary,
        border: `1px solid ${theme.colors.border.weak}`,
        color: theme.colors.text.primary,
        padding: theme.spacing(1),
      },
    },
    { dark: isDark }
  );
}

/**
 * Creates a syntax highlighter for data link variables (${...})
 * Matches the pattern from the old Prism implementation: (\${\S+?})
 */
export function createDataLinkHighlighter(theme: GrafanaTheme2): Extension {
  // Regular expression matching ${...} patterns (same as old implementation)
  const variablePattern = /\$\{[^}]+\}/g;

  const variableDecoration = Decoration.mark({
    class: 'cm-variable',
  });

  const viewPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const decorations: Array<{ from: number; to: number }> = [];
        const text = view.state.doc.toString();
        let match;

        // Reset regex state
        variablePattern.lastIndex = 0;

        while ((match = variablePattern.exec(text)) !== null) {
          decorations.push({
            from: match.index,
            to: match.index + match[0].length,
          });
        }

        return Decoration.set(decorations.map((range) => variableDecoration.range(range.from, range.to)));
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

  return viewPlugin;
}

/**
 * Creates autocomplete function for data link variables
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
