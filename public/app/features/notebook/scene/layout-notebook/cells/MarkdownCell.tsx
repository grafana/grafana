import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useMemo, useRef } from 'react';

import { type GrafanaTheme2, renderTextPanelMarkdown } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';
import { type CellContentKind } from 'app/features/notebook/types';

import { buildFocusExtension } from './CodeCell';
import { MarkdownFormatToolbar } from './MarkdownFormatToolbar';
import { markdownLivePreview } from './markdownLivePreview';

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
  onChange: (content: CellContentKind) => void;
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
 * on top — Notion/Obsidian-style live formatting that hides `**`/`#`/etc. markers and applies the
 * corresponding styling inline, based on the syntax tree and the current selection. The stored text is
 * unaffected either way: this is a view-layer decoration, not a different representation.
 */
export function MarkdownCell({ content, isEditing, autoFocus, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const livePreview = useMemo(() => markdownLivePreview(theme), [theme]);

  // Unlike CodeCell, this editor unmounts and remounts every time `isEditing` toggles (see below) —
  // it isn't kept alive with a `readOnly` flip. CodeMirror builds a fresh view on every mount, and a
  // fresh view runs every plugin's constructor regardless of whether the `extensions` array handed to
  // it is one it has seen before, so a memoized-but-stale focus extension would still steal focus on
  // every re-entry into edit mode, not just on insertion. `pendingAutoFocus` is a one-shot flag instead:
  // it captures `autoFocus && isEditing` at this component's own first render (autoFocus is only ever
  // true for the cell the reader just inserted, and insertion only happens while already editing, so
  // that first render already carries the final values) and is cleared the one time it's spent, so
  // later remounts of the editor never see it again.
  // Wraps the editor so MarkdownFormatToolbar can recover its EditorView via EditorView.findFromDOM —
  // CodeMirrorEditor exposes no ref, same reason CodeCell needs buildFocusExtension for the caret.
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const pendingAutoFocus = useRef(autoFocus && isEditing);
  const focusExtension = useMemo(() => {
    if (!isEditing || !pendingAutoFocus.current) {
      return undefined;
    }
    pendingAutoFocus.current = false;
    return buildFocusExtension();
  }, [isEditing]);

  if (content.kind !== 'Markdown') {
    return null;
  }

  if (!isEditing) {
    const html = renderTextPanelMarkdown(content.spec.text);
    return <DangerouslySetHtmlContent html={html} className={cx('markdown-html', styles.markdown)} />;
  }

  return (
    <div ref={editorContainerRef}>
      <CodeMirrorEditor
        value={content.spec.text}
        language="markdown"
        // Grows with its content, like CodeCell: a notebook is a document, so a cell that scrolls
        // internally inside a page that already scrolls is worse than a tall cell.
        height="auto"
        lineWrapping
        basicSetup={EDIT_SETUP}
        extensions={[livePreview, ...(focusExtension ?? [])]}
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
