import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { Prec } from '@codemirror/state';
import { keymap, placeholder as placeholderExtension, type KeyBinding } from '@codemirror/view';
import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useMemo, useRef, useState } from 'react';

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
// history: false for the same reason as CodeCell's — Cmd+Z belongs to NotebookEditHistory, not to a
// second, independent undo stack CodeMirror would otherwise keep of its own.
const EDIT_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  history: false,
};

interface Props {
  content: CellContentKind;
  isEditing: boolean;
  /** Set on a cell the reader just inserted, so they can type into it without clicking it first. */
  autoFocus?: boolean;
  /** A nonce that changes on every fresh request to focus this cell — see useFocusExtension. */
  focusRequestId?: number;
  /**
   * Where the caret should land on that same focus grant, instead of the document's own end — the
   * one case that matters today is a cell created by splitting another one mid-sentence, where this
   * cell's own content isn't just short starter text but carries the reader's own text along with it
   * (see NotebookLayoutManager's own onAdvance). Omitted everywhere else.
   */
  caretOffset?: number;
  onChange: (content: CellContentKind) => void;
  placeholder?: string;
  /**
   * Intercepts a plain Enter keypress (Shift+Enter still inserts a literal newline) instead of it
   * inserting one — this cell keeps only the text before the caret; `remainder` is whatever came
   * after it, already removed from here, for the caller to seed into the new block Enter creates
   * (a genuine split, not just "add an empty block below"). `marker` is set instead of/alongside
   * that when Enter was pressed on a non-empty list item, so the caller can continue the list there.
   */
  onSubmit?: (remainder: string, marker?: string) => void;
}

export function MarkdownCell({
  content,
  isEditing,
  autoFocus,
  focusRequestId,
  caretOffset,
  onChange,
  placeholder,
  onSubmit,
}: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const livePreview = useMemo(() => markdownLivePreview(theme), [theme]);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const focusExtension = useFocusExtension({ autoFocus, isEditing, focusRequestId, caretOnFocus: caretOffset });

  // Drives CodeMirror's `value` locally instead of straight from `content.spec.text`, so the editor
  // never waits on the round trip back through onChange -> the layout manager -> Scenes state -> a
  // re-render — that lag is what let `@uiw/react-codemirror`'s own value-reconciliation treat this
  // cell's own just-typed text as an external change and force a whole-document replace, flashing
  // hidden markers (e.g. bold's `**`) visible until the replace settled. `lastEmittedText` is what
  // tells the two apart: only a `content.spec.text` that doesn't match what this cell itself last
  // reported is a genuine external change (a converted heading marker, a seeded list continuation) —
  // that's the one case local `text` should resync to.
  const contentText = content.kind === 'Markdown' ? content.spec.text : '';
  const [text, setText] = useState(contentText);
  const lastEmittedText = useRef(contentText);
  if (contentText !== lastEmittedText.current) {
    setText(contentText);
    lastEmittedText.current = contentText;
  }

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
              // Empty item — same "exit the list" gesture as plain Enter, same cell. Reaches for
              // lang-markdown's own Enter command directly rather than falling through to CM6's
              // default Shift-Enter binding: that default has no list awareness at all (it only
              // copies the current line's leading whitespace), leaving the empty marker in place
              // instead of clearing it, since lang-markdown's smart handling binds to plain Enter only.
              return insertNewlineContinueMarkup(view);
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
          const { state } = view;
          const pos = state.selection.main.head;
          const tree = syntaxTree(state);

          let marker: string | undefined;
          if (enclosingListKind(tree, pos)) {
            marker = nextListContinuation(state, pos);
            // No marker means an empty item — the conventional "I'm done with this list" gesture,
            // left to lang-markdown's own bundled Enter handling (clears the marker, same cell).
            // A non-empty item, on the other hand, splits exactly like a plain paragraph would,
            // just with the next marker seeded ahead of whatever text moves along with it.
            if (marker === undefined) {
              return false;
            }
          }

          // Same boundary correction Shift+Enter uses (see newlineInsertionPoint's own doc comment):
          // splitting exactly at `pos` could cut a closing bold/italic/code/strikethrough marker in
          // two between the cells — this one loses its closer, the new one starts with an unpaired
          // one — so the split point moves past it first.
          const splitAt = newlineInsertionPoint(tree, pos);

          // Whatever sits after the split point belongs in the new block, not this one — that's what
          // makes this a split rather than merely "add an empty block below." Removed here so it
          // isn't left behind, duplicated in both cells.
          const remainder = state.sliceDoc(splitAt, state.doc.length);
          if (remainder) {
            view.dispatch({ changes: { from: splitAt, to: state.doc.length } });
          }

          onSubmitRef.current?.(remainder, marker);
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
        value={text}
        // Grows with its content, like CodeCell: a notebook is a document, so a cell that scrolls
        // internally inside a page that already scrolls is worse than a tall cell.
        height="auto"
        lineWrapping
        basicSetup={EDIT_SETUP}
        theme={livePreview.theme}
        extensions={[livePreview.extensions, ...placeholderExt, ...enterExt, ...(focusExtension ?? [])]}
        aria-label={t('notebook.cell.markdown.aria-label-editor', 'Markdown')}
        onChange={(value) => {
          // Updated before the external onChange runs, so this render already has `text` matching
          // what CodeMirror just reported — no waiting on the round trip described above.
          setText(value);
          lastEmittedText.current = value;
          onChange({ kind: 'Markdown', spec: { ...content.spec, text: value } });
        }}
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
