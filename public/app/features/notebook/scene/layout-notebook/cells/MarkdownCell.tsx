import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { lazy, Suspense } from 'react';

import { type GrafanaTheme2, renderTextPanelMarkdown } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { type CellContentKind } from 'app/features/notebook/types';

import { useFocusExtension } from './focusExtension';

// Deferred rather than imported directly: this is the only piece of MarkdownCell that needs
// CodeMirror at all. Reading a notebook shouldn't pay for that.
const MarkdownCellEditor = lazy(() =>
  import(/* webpackChunkName: "notebook-markdown-editor" */ './MarkdownCellEditor').then((m) => ({
    default: m.MarkdownCellEditor,
  }))
);

export interface MarkdownCellProps {
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
}: MarkdownCellProps) {
  const styles = useStyles2(getStyles);
  const focusExtension = useFocusExtension({ autoFocus, isEditing, focusRequestId, caretOnFocus: caretOffset });

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
    <Suspense fallback={<LoadingPlaceholder text={t('notebook.cell.markdown.loading-editor', 'Loading editor')} />}>
      <MarkdownCellEditor
        content={content}
        onChange={onChange}
        placeholder={placeholder}
        onSubmit={onSubmit}
        focusExtension={focusExtension}
      />
    </Suspense>
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
