import { syntaxTree } from '@codemirror/language';
import { Prec } from '@codemirror/state';
import { keymap, placeholder as placeholderExtension, type KeyBinding } from '@codemirror/view';
import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useMemo, useRef } from 'react';

import { type GrafanaTheme2, renderTextPanelMarkdown } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';
import { type CellContentKind } from 'app/features/notebook/types';

import { MarkdownFormatToolbar } from './MarkdownFormatToolbar';
import { useFocusExtension } from './focusExtension';
import {
  enclosingListKind,
  markdownLivePreview,
  newlineInsertionPoint,
  nextListContinuation,
} from './markdownLivePreview';

// Same rationale as CodeCell's EDIT_SETUP: reading a notebook should look like reading a document,
// so gutters/line numbers stay off. There is no read-only counterpart here — unlike CodeCell, the
// not-editing case below never mounts CodeMirror at all, so this is the only setup this cell needs.
const EDIT_SETUP = {
  lineNumbers: false,
  foldGutter: false,
};

interface Props {
  content: CellContentKind;
  isEditing: boolean;
  /** Set on a cell the reader just inserted, so they can type into it without clicking it first. */
  autoFocus?: boolean;
  /** A nonce that changes on every fresh request to focus this cell — see useFocusExtension. */
  focusRequestId?: number;
  onChange: (content: CellContentKind) => void;
  /**
   * Shown via CM6's own placeholder extension while the cell is empty, then disappears on the first
   * keystroke — and hidden again (see markdownLivePreview's `.cm-placeholder` rule) until the cell
   * actually has the caret, so an unfocused empty block doesn't read as leftover copy. Only the
   * trailing empty cell every document always has (see NotebookLayoutManager's own invariant comment)
   * gets one — see NotebookCellRenderer.
   */
  placeholder?: string;
  /**
   * Intercepts a plain Enter keypress (Shift+Enter still inserts a literal newline) instead of it
   * inserting one, moving on to whatever this means for the caller — Notion/Jupyter/Datadog all use
   * this as the "advance to the next block" gesture. Wired for every markdown cell (see
   * NotebookCellRenderer/NotebookLayoutManager) — Enter always splits into a new cell inserted right
   * after this one, wherever in the document this cell happens to be.
   *
   * Called with a marker (`'- '`, or the next number) when Enter was pressed on a non-empty list
   * item — the caller is expected to seed the marker into whatever cell it advances to, continuing the
   * list there instead of leaving a plain empty block. Called with no argument for a plain paragraph.
   */
  onSubmit?: (marker?: string) => void;
}

/**
 * Not editing: mirrors the text panel — renderTextPanelMarkdown sanitizes its output (XSS-safe) and
 * the result is rendered via DangerouslySetHtmlContent with the shared `markdown-html` class. The
 * global `.markdown-html` styles cover lists/tables/links but not headings, blockquotes or code —
 * which notebook cells rely on — so getStyles below adds those to read like a document. This is the
 * cheap path and the common one (notebooks are read far more than edited), so it stays free of the
 * CodeMirror bundle entirely.
 *
 * Editing: a CodeMirror text editor over the same markdown string, with markdownLivePreview layered
 * on top — live formatting that hides `**`/`#`/etc. markers and applies the corresponding styling
 * inline, based on the syntax tree. Markers stay hidden unconditionally (links are the one exception,
 * revealing near the cursor — see markdownLivePreview.ts). The stored text is unaffected either way:
 * this is a view-layer decoration, not a different representation.
 */
export function MarkdownCell({
  content,
  isEditing,
  autoFocus,
  focusRequestId,
  onChange,
  placeholder,
  onSubmit,
}: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const livePreview = useMemo(() => markdownLivePreview(theme), [theme]);

  // Wraps the editor so MarkdownFormatToolbar can recover its EditorView via EditorView.findFromDOM —
  // CodeMirrorEditor exposes no ref, same reason useFocusExtension needs buildFocusExtension for the
  // caret rather than a plain `.focus()` call here.
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Unlike CodeCell, this editor unmounts and remounts every time `isEditing` toggles rather than being
  // kept alive with a `readOnly` flip — see useFocusExtension's own doc comment for why that still
  // works out correctly with the same shared hook.
  const focusExtension = useFocusExtension({ autoFocus, isEditing, focusRequestId });

  const placeholderExt = useMemo(() => (placeholder ? [placeholderExtension(placeholder)] : []), [placeholder]);

  // A ref rather than a useMemo dependency: onSubmit is a fresh closure every render (its caller reads
  // current component state from it), but whether a cell has this behavior *at all* never changes for
  // its lifetime, so the keymap extension itself only needs to be built once — not reconfigure CM6 on
  // every keystroke just because the closure's identity changed.
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const enterExt = useMemo(() => {
    const bindings: KeyBinding[] = [
      // CM6 treats "Enter" and "Shift-Enter" as entirely separate bindings (there is no fallback from
      // one to the other) — plain Enter is handled below, gated on onSubmit; this one is independent
      // of it, since "does Shift+Enter continue the list" isn't really an onSubmit concern.
      //
      // Without this, Shift+Enter on a list line fell through to basicSetup's own bundled
      // Shift-Enter binding (`insertNewlineAndIndent`), which only ever copies the current line's
      // leading *whitespace* — lang-markdown defines no indent rule for list nodes at all, so it
      // never re-emits the marker glyph itself. That's what "sometimes" looked like: a flush-left
      // item got a bare blank line (zero indent), an indented one got a blank line that merely
      // *happened* to start at the same column the marker did — never a real continued bullet/number.
      {
        key: 'Shift-Enter',
        run: (view) => {
          const pos = view.state.selection.main.head;
          const tree = syntaxTree(view.state);
          // Right after the last letter of a bold/italic/code/strikethrough span, `pos` sits exactly
          // at its closing marker — splitting the line there breaks the formatting itself (see
          // newlineInsertionPoint's own doc comment), so the newline goes just past the marker
          // instead, keeping "Hello" bold on its own line rather than turning it into literal `**`s.
          const insertAt = newlineInsertionPoint(tree, pos);

          if (enclosingListKind(tree, pos)) {
            const marker = nextListContinuation(view.state, pos);
            if (marker === undefined) {
              return false; // empty item — same "exit the list" gesture as plain Enter, same cell
            }
            view.dispatch({
              changes: { from: insertAt, insert: '\n' + marker },
              selection: { anchor: insertAt + 1 + marker.length },
              scrollIntoView: true,
            });
            return true;
          }

          if (insertAt === pos) {
            // A plain paragraph with nothing to step around — defer to CM6's own default newline,
            // unintercepted.
            return false;
          }
          view.dispatch({
            changes: { from: insertAt, insert: '\n' },
            selection: { anchor: insertAt + 1 },
            scrollIntoView: true,
          });
          return true;
        },
      },
    ];

    if (onSubmit) {
      bindings.push({
        key: 'Enter',
        run: (view) => {
          const pos = view.state.selection.main.head;
          if (enclosingListKind(syntaxTree(view.state), pos)) {
            const marker = nextListContinuation(view.state, pos);
            // No marker means an empty item — the conventional "I'm done with this list" gesture,
            // left to lang-markdown's own bundled Enter handling (clears the marker, same cell).
            // A non-empty item, on the other hand, advances exactly like a plain paragraph would,
            // just with the next marker seeded into wherever it lands, so the list keeps going.
            if (marker === undefined) {
              return false;
            }
            onSubmitRef.current?.(marker);
            return true;
          }
          onSubmitRef.current?.();
          return true;
        },
      });
    }

    // Prec.highest so this wins over basicSetup's bundled default Enter/Shift-Enter bindings — same
    // reason CodeEditor.tsx's own autocompleteTabKeymap needs the same precedence.
    return [Prec.highest(keymap.of(bindings))];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ref is always current; only whether onSubmit exists at all should rebuild this
  }, [Boolean(onSubmit)]);

  if (content.kind !== 'Markdown') {
    return null;
  }

  if (!isEditing) {
    const html = renderTextPanelMarkdown(content.spec.text);
    // An empty cell is a real, legitimate state now — the trailing-slot invariant (see
    // NotebookLayoutManager) can leave one sitting in `cells` indefinitely if the reader never types
    // into it before leaving edit mode, and empty (or whitespace-only) markdown renders to an empty
    // string. DangerouslySetHtmlContent throws on any falsy `html`, so this has to short-circuit
    // before ever reaching it rather than relying on the renderer to cope with "nothing to render".
    if (!html) {
      return null;
    }
    return <DangerouslySetHtmlContent html={html} className={cx('markdown-html', styles.markdown)} />;
  }

  return (
    <div ref={editorContainerRef}>
      <CodeMirrorEditor
        value={content.spec.text}
        // No `language` prop: livePreview.extensions already bundles markdownLanguageSupport (with the
        // Strikethrough GFM extension enabled) — see markdownLivePreview.ts for why the shared
        // `language="markdown"` loader isn't used here.
        // Grows with its content, like CodeCell: a notebook is a document, so a cell that scrolls
        // internally inside a page that already scrolls is worse than a tall cell.
        height="auto"
        lineWrapping
        basicSetup={EDIT_SETUP}
        theme={livePreview.theme}
        extensions={[livePreview.extensions, ...placeholderExt, ...enterExt, ...(focusExtension ?? [])]}
        aria-label={t('notebook.cell.markdown.aria-label-editor', 'Markdown')}
        // The spread is defensive: MarkdownCellContentSpec only has `text` today, but this keeps any
        // future schema field from being silently dropped on the first keystroke, matching CodeCell.
        onChange={(value) => onChange({ kind: 'Markdown', spec: { ...content.spec, text: value } })}
      />
      <MarkdownFormatToolbar editorContainerRef={editorContainerRef} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  markdown: css({
    'h1, h2, h3, h4, h5, h6': {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
      fontWeight: theme.typography.fontWeightMedium,
    },
    '& > :first-child': {
      marginTop: 0,
    },
    h1: { fontSize: theme.typography.h1.fontSize, lineHeight: theme.typography.h1.lineHeight },
    // Section headers get an underline rule, matching the notebook document look.
    h2: {
      fontSize: theme.typography.h2.fontSize,
      lineHeight: theme.typography.h2.lineHeight,
      paddingBottom: theme.spacing(1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
    h3: { fontSize: theme.typography.h3.fontSize, lineHeight: theme.typography.h3.lineHeight },
    h4: { fontSize: theme.typography.h4.fontSize },
    p: { marginBottom: theme.spacing(1) },
    blockquote: {
      margin: theme.spacing(1, 0),
      padding: theme.spacing(0.5, 2),
      borderLeft: `3px solid ${theme.colors.border.strong}`,
      color: theme.colors.text.secondary,
    },
    code: {
      background: theme.colors.background.secondary,
      padding: theme.spacing(0.25, 0.5),
      borderRadius: theme.shape.radius.default,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
    },
    pre: {
      background: theme.colors.background.secondary,
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      overflow: 'auto',
      code: { background: 'none', padding: 0 },
    },
    hr: {
      border: 'none',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(2, 0),
    },
  }),
});
