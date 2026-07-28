import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';

import { type GrafanaTheme2, renderTextPanelMarkdown } from '@grafana/data';
import { type CellContentKind } from '@grafana/schema/apis/notebook/v2beta1';
import { useStyles2 } from '@grafana/ui';

// Mirrors the text panel: renderTextPanelMarkdown sanitizes its output (XSS-safe) and the
// result is rendered via DangerouslySetHtmlContent with the shared `markdown-html` class.
// The global `.markdown-html` styles cover lists/tables/links but not headings, blockquotes
// or code — which notebook cells rely on — so we add those here to read like a document.
export function MarkdownCell({ content }: { content: CellContentKind }) {
  const styles = useStyles2(getStyles);

  if (content.kind !== 'Markdown') {
    return null;
  }

  const html = renderTextPanelMarkdown(content.spec.text);
  return <DangerouslySetHtmlContent html={html} className={cx('markdown-html', styles.markdown)} />;
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
