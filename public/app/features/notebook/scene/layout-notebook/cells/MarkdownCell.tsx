import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { lazy, Suspense, useMemo, type MouseEvent } from 'react';

import { type GrafanaTheme2, renderTextPanelMarkdown } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { type CellContentKind } from 'app/features/notebook/types';

import { useFocusExtension } from './focusExtension';
import { addHeadingIds } from './markdownHeadingAnchors';
import { headingBoldWeight, headingStyles } from './markdownHeadingStyles';

const MarkdownCellEditor = lazy(() =>
  import(/* webpackChunkName: "notebook-markdown-editor" */ './MarkdownCellEditor').then((m) => ({
    default: m.MarkdownCellEditor,
  }))
);

export interface MarkdownCellProps {
  content: CellContentKind;
  isEditing: boolean;
  autoFocus?: boolean;
  focusRequestId?: number;
  caretOffset?: number;
  /** Which edge of the cell to reveal on that same grant — see useFocusExtension's own doc comment. */
  scrollAlign?: ScrollLogicalPosition;
  onChange: (content: CellContentKind) => void;
  placeholder?: string;
  onSubmit?: (remainder: string, marker?: string) => void;
  /** ArrowUp/ArrowDown once the caret has nowhere further to go inside this cell. See navigationKeymap. */
  onNavigate?: (direction: 'up' | 'down') => void;
}

export function MarkdownCell({
  content,
  isEditing,
  autoFocus,
  focusRequestId,
  caretOffset,
  scrollAlign,
  onChange,
  placeholder,
  onSubmit,
  onNavigate,
}: MarkdownCellProps) {
  const styles = useStyles2(getStyles);
  const focusExtension = useFocusExtension({
    autoFocus,
    isEditing,
    focusRequestId,
    caretOnFocus: caretOffset,
    scrollAlign,
  });
  const html = useMemo(
    () => (content.kind === 'Markdown' ? addHeadingIds(renderTextPanelMarkdown(content.spec.text)) : ''),
    [content]
  );

  if (content.kind !== 'Markdown') {
    return null;
  }

  if (!isEditing) {
    if (!html) {
      return null;
    }
    return (
      <DangerouslySetHtmlContent
        html={html}
        className={cx('markdown-html', styles.markdown)}
        onClick={handleAnchorClick}
      />
    );
  }

  return (
    <Suspense fallback={<LoadingPlaceholder text={t('notebook.cell.markdown.loading-editor', 'Loading editor')} />}>
      <MarkdownCellEditor
        content={content}
        onChange={onChange}
        placeholder={placeholder}
        onSubmit={onSubmit}
        onNavigate={onNavigate}
        focusExtension={focusExtension}
      />
    </Suspense>
  );
}

/**
 * Jumps to the heading a table-of-contents link names, smoothly. The target may be in another cell,
 * so it is looked up in the document rather than inside this cell. Handling the click here also
 * keeps Grafana's global link interceptor from turning the hash into an instant jump.
 */
function handleAnchorClick(event: MouseEvent<HTMLDivElement>) {
  const anchor = event.target instanceof Element ? event.target.closest('a') : null;
  const href = anchor?.getAttribute('href');
  if (!href?.startsWith('#')) {
    return;
  }

  const destination = document.getElementById(decodeURIComponent(href.slice(1)));
  if (!destination) {
    return;
  }

  event.preventDefault();
  destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Keeps the address shareable without the instant jump the browser does on a hash change, and
  // without adding a history entry for every contents link clicked.
  window.history.replaceState(window.history.state, '', href);
}

const getStyles = (theme: GrafanaTheme2) => ({
  markdown: css({
    'h1, h2, h3, h4, h5, h6': {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
      // Clears the sticky controls row when a contents link scrolls a heading to the top, same
      // allowance the cell frames make for focus scrolling.
      scrollMarginTop: theme.spacing(14),
    },
    '& > :first-child': {
      marginTop: 0,
    },
    h1: headingStyles(theme.typography.h1),
    h2: {
      ...headingStyles(theme.typography.h2),
      paddingBottom: theme.spacing(1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
    h3: headingStyles(theme.typography.h3),
    h4: headingStyles(theme.typography.h4),
    'h1 strong, h1 b': { fontWeight: headingBoldWeight(theme.typography.h1, theme.typography) },
    'h2 strong, h2 b': { fontWeight: headingBoldWeight(theme.typography.h2, theme.typography) },
    'h3 strong, h3 b': { fontWeight: headingBoldWeight(theme.typography.h3, theme.typography) },
    'h4 strong, h4 b': { fontWeight: headingBoldWeight(theme.typography.h4, theme.typography) },
    'h5 strong, h5 b': { fontWeight: headingBoldWeight(theme.typography.h5, theme.typography) },
    'h6 strong, h6 b': { fontWeight: headingBoldWeight(theme.typography.h6, theme.typography) },
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
    '& :not(pre) > code': {
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
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
