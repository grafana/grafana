import { autocompletion } from '@codemirror/autocomplete';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, tooltips } from '@codemirror/view';
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
// niceties (undo history, the default keymap) stay on.
//
// `drawSelection` is off so the browser's native caret/selection is used. With
// the placeholder rendered as an overlay (not a CodeMirror widget), an empty
// doc is a normal `<div class="cm-line"><br></div>`, which the native caret
// anchors to and renders on the first focus — the drawn caret did not show on
// an empty doc here.
const INLINE_BASIC_SETUP = {
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
      // `drawSelection` is off (see basicSetup), so this colors the native caret.
      caretColor: theme.colors.text.primary,
    },
    '.cm-line': {
      padding: 0,
    },
    // The popup is parented to `document.body` (see `tooltips` extension) so it
    // escapes the modal's clipping/stacking context; lift it above the modal.
    '.cm-tooltip': {
      zIndex: theme.zIndex.portal,
    },
    // Autocomplete dropdown — match Grafana surfaces rather than the editor theme.
    '.cm-tooltip.cm-tooltip-autocomplete': {
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
    },
    // The detail panel ("info" / documentation). CodeMirror gives it no color of
    // its own, so without this it falls back to the editor's light/dark base
    // theme and is unreadable on Grafana surfaces.
    '.cm-tooltip.cm-completionInfo': {
      backgroundColor: theme.colors.background.primary,
      color: theme.colors.text.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      padding: theme.spacing(0.5, 1),
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.bodySmall.fontSize,
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
  // Render the standard Grafana input chrome (border, background, radius,
  // typography) so the field reads like a normal text input. The inner editor
  // is transparent (see `createInlineInputTheme`), so this background — and the
  // placeholder overlay behind it — show through.
  wrapper: cx(
    getInputStyles({ theme }).input,
    css({
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      // Pin to the standard input height (rather than free-sizing to the line
      // height) so this lines up with sibling `Input` fields; `alignItems`
      // centers the single editor line within it.
      minHeight: theme.spacing(theme.components.height.md),
      padding: theme.spacing(0, 1),
      '&:focus-within': getFocusStyles(theme),
    })
  ),
  // The editor fills the row, sits above the placeholder overlay, and may shrink
  // so long values scroll horizontally instead of stretching the field.
  editor: css({
    position: 'relative',
    zIndex: 1,
    flex: 1,
    minWidth: 0,
    '& > div': {
      width: '100%',
    },
  }),
  // The placeholder is rendered here as an overlay rather than via CodeMirror's
  // inline widget: the widget left the empty editor with no caret anchor, so the
  // caret was invisible until the first edit. Sitting behind the transparent
  // editor, this shows through while the editor keeps a normal caret.
  placeholder: css({
    position: 'absolute',
    left: theme.spacing(1),
    right: theme.spacing(1),
    top: '50%',
    transform: 'translateY(-50%)',
    color: theme.colors.text.disabled,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.body.fontSize,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  }),
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
      // Render tooltips (the completion popup) in `document.body` so they aren't
      // clipped by, or stacked beneath, a containing modal's scroll/footer.
      tooltips({ parent: document.body }),
      // The visible placeholder is an overlay (see render); expose it to
      // assistive tech via `aria-placeholder` on the editable element.
      ...(placeholder ? [EditorView.contentAttributes.of({ 'aria-placeholder': placeholder })] : []),
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
      <div className={styles.editor}>
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
      {placeholder && value.length === 0 && (
        <div className={styles.placeholder} aria-hidden>
          {placeholder}
        </div>
      )}
    </div>
  );
});
