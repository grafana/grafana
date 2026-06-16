import { autocompletion } from '@codemirror/autocomplete';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, placeholder as placeholderExtension } from '@codemirror/view';
import { css, cx } from '@emotion/css';
import { memo, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
import { getInputStyles } from '../Input/Input';

import { CodeMirrorEditor } from './CodeEditorLazy';
import { type CodeMirrorCompletionSource, type CodeMirrorExtension } from './types';

export interface CodeMirrorInlineInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Placeholder shown when the input is empty. */
  placeholder?: string;
  /**
   * Completion sources, e.g. for variable suggestions.
   * Memoize this — a new array each render reconfigures the editor.
   */
  completionSources?: readonly CodeMirrorCompletionSource[];
  /**
   * Extra extensions layered on top, e.g. syntax highlighting or token theming.
   * Memoize this — a new array each render reconfigures the editor.
   */
  extensions?: CodeMirrorExtension[];
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /**
   * DOM id applied to the wrapping element. The editable element is rendered as
   * a descendant, so selectors like `#your-id [contenteditable="true"]` resolve
   * to it.
   */
  id?: string;
}

/**
 * Keeps the editor to a single line: any transaction that would produce more
 * than one line (a typed Enter, a programmatic newline) is dropped.
 */
export const singleLineFilter: Extension = EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr));

/**
 * Strips newlines from pasted text so multi-line clipboard content (e.g. a URL
 * copied with a trailing newline) collapses into the single line rather than
 * being rejected wholesale by `singleLineFilter`.
 */
export const stripNewlinesOnPaste: Extension = EditorView.domEventHandlers({
  paste(event, view) {
    const text = event.clipboardData?.getData('text');
    if (!text || !/[\r\n]/.test(text)) {
      return false;
    }
    event.preventDefault();
    view.dispatch(view.state.replaceSelection(text.replace(/[\r\n]+/g, '')));
    return true;
  },
});

// A single-line text field shouldn't look or behave like a code editor. Disable
// gutters, active-line highlighting, bracket closing/matching, auto-indent, and
// the bundled autocompletion (this component configures its own). Editing
// niceties (undo history, the default keymap, selection drawing) stay on.
const INLINE_BASIC_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  closeBrackets: false,
  bracketMatching: false,
  indentOnInput: false,
  autocompletion: false,
} as const;

function createInlineInputTheme(theme: GrafanaTheme2): Extension {
  return EditorView.theme({
    '&': {
      fontSize: theme.typography.body.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      backgroundColor: 'transparent',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      fontFamily: theme.typography.fontFamilyMonospace,
      overflowX: 'auto',
      overflowY: 'hidden',
      lineHeight: 'inherit',
    },
    '.cm-content': {
      padding: 0,
      color: theme.colors.text.primary,
      caretColor: theme.colors.text.primary,
    },
    '.cm-line': {
      padding: 0,
    },
    '.cm-placeholder': {
      color: theme.colors.text.disabled,
      fontStyle: 'normal',
    },
    // Autocomplete dropdown — match Grafana surfaces rather than the editor theme.
    '.cm-tooltip.cm-tooltip-autocomplete': {
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
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
      backgroundColor: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
    '.cm-completionLabel': {
      fontFamily: theme.typography.fontFamilyMonospace,
    },
    '.cm-completionDetail': {
      color: theme.colors.text.secondary,
      fontStyle: 'normal',
      marginLeft: theme.spacing(1),
    },
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The consuming field (e.g. a `Field`) owns the outer border; this element
  // provides the input chrome (typography, radius, focus ring) but stays
  // transparent and borderless so it sits cleanly inside that field.
  wrapper: cx(
    getInputStyles({ theme }).input,
    css({
      width: '100%',
      padding: '3px 8px',
      backgroundColor: 'transparent',
      border: 'none',
      '&:focus-within': getFocusStyles(theme),
    })
  ),
});

/**
 * A single-line text input built on `CodeMirrorEditor`, styled to read as a
 * standard Grafana text field. Supports placeholder text and completion
 * sources; layer syntax highlighting or token theming via `extensions`.
 */
export const CodeMirrorInlineInput = memo(function CodeMirrorInlineInput({
  value,
  onChange,
  placeholder,
  completionSources,
  extensions: extraExtensions,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  id,
}: CodeMirrorInlineInputProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const editorTheme = useMemo(() => createInlineInputTheme(theme), [theme]);

  const extensions = useMemo(
    () => [
      singleLineFilter,
      stripNewlinesOnPaste,
      ...(placeholder ? [placeholderExtension(placeholder)] : []),
      // Configure autocompletion directly (rather than via the base's
      // `completionSources` prop) so `interactionDelay` can be disabled: Enter
      // has no other purpose in a single-line input, so it should accept the
      // selected completion immediately, matching the previous behavior.
      ...(completionSources?.length ? [autocompletion({ override: [...completionSources], interactionDelay: 0 })] : []),
      ...(extraExtensions ?? []),
    ],
    [placeholder, completionSources, extraExtensions]
  );

  return (
    <div className={styles.wrapper} id={id}>
      <CodeMirrorEditor
        value={value}
        onChange={onChange}
        theme={editorTheme}
        basicSetup={INLINE_BASIC_SETUP}
        height="auto"
        extensions={extensions}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
      />
    </div>
  );
});
