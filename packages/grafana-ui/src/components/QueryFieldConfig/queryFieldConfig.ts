import type { Extension } from '@codemirror/state';
import type { EditorView as CodeMirrorEditorView } from '@codemirror/view';

import { type GrafanaTheme2 } from '@grafana/data';

import { getFocusStyles } from '../../themes/mixins';
import { type CodeMirrorBasicSetup, type CodeMirrorEditorTheme, type CodeMirrorExtension } from '../CodeMirror/types';

export interface QueryFieldConfigOptions {
  /**
   * Called when the user presses Shift+Enter or Ctrl+Enter. Plain Enter keeps
   * its default behavior and inserts a newline. If the consumer debounces
   * `onChange`, flush the pending change in this callback before running so the
   * query that executes matches what was typed.
   */
  onRunQuery?: () => void;
  /**
   * Called when the editor loses focus.
   */
  onBlur?: () => void;
  /**
   * Placeholder shown while the field is empty.
   */
  placeholder?: string;
}

export interface QueryFieldConfig {
  theme: CodeMirrorEditorTheme;
  basicSetup: CodeMirrorBasicSetup;
  lineWrapping: true;
  extensions: CodeMirrorExtension[];
}

// A query field reads as a standard Grafana input, not a code editor: no
// gutters, no active-line highlight, no bracket closing/matching, no
// auto-indent, and no bundled autocompletion. Editing niceties (undo history,
// the default keymap — including Enter for a newline) stay on.
//
// `drawSelection` is off so the browser's native caret and selection are used,
// matching the plain-contenteditable behavior of the Slate field this replaces.
const QUERY_FIELD_BASIC_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  closeBrackets: false,
  bracketMatching: false,
  indentOnInput: false,
  autocompletion: false,
  drawSelection: false,
} as const;

/**
 * Configuration for rendering a `CodeMirrorEditor` as a query field: styled as
 * a standard Grafana input, runs the query on Shift+Enter or Ctrl+Enter, and
 * wraps long queries instead of scrolling horizontally. Replaces the deprecated
 * Slate-based `QueryField`.
 *
 * Spread the result onto the editor and memoize it — a new config each render
 * reconfigures the editor:
 *
 * ```tsx
 * const config = useMemo(() => getQueryFieldConfig(theme, { onRunQuery }), [theme, onRunQuery]);
 * return <CodeMirrorEditor value={query} onChange={onChange} height="auto" {...config} />;
 * ```
 */
export function getQueryFieldConfig(theme: GrafanaTheme2, options: QueryFieldConfigOptions = {}): QueryFieldConfig {
  const { onRunQuery, onBlur, placeholder } = options;

  return {
    theme: 'none',
    basicSetup: QUERY_FIELD_BASIC_SETUP,
    lineWrapping: true,
    extensions: [createQueryFieldExtension(theme, { onRunQuery, onBlur, placeholder })],
  };
}

async function createQueryFieldExtension(
  theme: GrafanaTheme2,
  { onRunQuery, onBlur, placeholder }: QueryFieldConfigOptions
): Promise<Extension> {
  const [{ Prec }, { EditorView, keymap, placeholder: placeholderExtension }] = await Promise.all([
    import('@codemirror/state'),
    import('@codemirror/view'),
  ]);
  const extensions: Extension[] = [createQueryFieldTheme(theme, EditorView)];

  if (onRunQuery) {
    const run = () => {
      onRunQuery();
      return true;
    };

    // Highest precedence so these win over the default keymap, which binds
    // Shift-Enter (insert newline) and Mod-Enter (insert blank line).
    extensions.push(
      Prec.highest(
        keymap.of([
          { key: 'Shift-Enter', run },
          { key: 'Ctrl-Enter', run },
        ])
      )
    );
  }

  if (onBlur) {
    extensions.push(
      EditorView.domEventHandlers({
        blur: () => {
          onBlur();
          return false;
        },
      })
    );
  }

  if (placeholder) {
    extensions.push(placeholderExtension(placeholder));
  }

  return extensions;
}

function createQueryFieldTheme(theme: GrafanaTheme2, EditorView: typeof CodeMirrorEditorView): Extension {
  return EditorView.theme(
    {
      // The editor root carries the standard input chrome (background, border,
      // radius) so the field lines up with sibling form controls.
      '&': {
        width: '100%',
        minHeight: theme.spacing(4),
        fontSize: theme.typography.body.fontSize,
        fontFamily: theme.typography.fontFamilyMonospace,
        color: theme.colors.text.primary,
        backgroundColor: theme.components.input.background,
        border: `1px solid ${theme.components.input.borderColor}`,
        borderRadius: theme.shape.radius.default,
      },
      '&.cm-focused': getFocusStyles(theme),
      '.cm-scroller': {
        fontFamily: theme.typography.fontFamilyMonospace,
        lineHeight: '18px',
      },
      '.cm-content': {
        padding: theme.spacing(0.75, 1),
        // `drawSelection` is off (see basicSetup), so this colors the native caret.
        caretColor: theme.colors.text.primary,
      },
      '.cm-line': {
        padding: 0,
      },
      '.cm-placeholder': {
        color: theme.colors.text.disabled,
      },
    },
    { dark: theme.isDark }
  );
}
