import { type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

import { DataLinkBuiltInVars, type GrafanaTheme2, VariableOrigin, type VariableSuggestion } from '@grafana/data';

import { type CodeMirrorCompletionContext, type CodeMirrorCompletionResult } from '../CodeMirror/types';
import { createVariableCompletionSource } from '../CodeMirror/variableCompletion';

// Matches a complete `${...}` variable reference anywhere in the document.
const VARIABLE_PATTERN = /\$\{[^}]+\}/g;

export type DataLinkInterpolationMode = 'url' | 'text';

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

function getApplyText(suggestion: VariableSuggestion, mode: DataLinkInterpolationMode): string {
  if (
    mode === 'text' ||
    suggestion.origin !== VariableOrigin.Template ||
    suggestion.value === DataLinkBuiltInVars.includeVars
  ) {
    return `\${${suggestion.value}}`;
  }
  return `\${${suggestion.value}:queryparam}`;
}

/**
 * Autocompletion source for data link variables, triggered by `$` — and, in
 * `'url'` mode, also by `=`, the query-param separator (`?key=`), which is
 * preserved rather than replaced.
 *
 * Pass `{ mode: 'text' }` for plain-text fields such as a link title: `=` no
 * longer triggers and template variables are formatted as `${var}` without the
 * URL-only `:queryparam` encoding.
 */
export function dataLinkAutocompletion(
  suggestions: VariableSuggestion[],
  options: { mode?: DataLinkInterpolationMode } = {}
): (context: CodeMirrorCompletionContext) => CodeMirrorCompletionResult | null {
  const { mode = 'url' } = options;

  return createVariableCompletionSource(suggestions, {
    separators: mode === 'url' ? ['='] : [],
    getInsertText: (suggestion) => getApplyText(suggestion, mode),
  });
}
