import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { lazy, Suspense } from 'react';

import { type GrafanaTheme2, renderTextPanelMarkdown } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { type CellContentKind } from 'app/features/notebook/types';

import { useFocusExtension } from './focusExtension';

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
  onChange: (content: CellContentKind) => void;
  placeholder?: string;
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
