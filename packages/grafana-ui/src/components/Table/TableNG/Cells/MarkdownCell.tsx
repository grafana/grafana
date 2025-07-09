import { css } from '@emotion/css';

import { GrafanaTheme2, renderMarkdown, formattedValueToString } from '@grafana/data';
import { FieldTextAlignment } from '@grafana/schema';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { MarkdownCellProps } from '../types';

export function MarkdownCell({ field, rowIdx }: MarkdownCellProps) {
  const value = field.values[rowIdx];
  const align: FieldTextAlignment | undefined = field.config?.custom?.align;
  const styles = useStyles2(getStyles, align);

  const markdownContent =
    typeof value === 'string' ? renderMarkdown(value) : formattedValueToString(field.display!(value));
  const markdownDiv = (
    <div className={styles.markdownOverrides} dangerouslySetInnerHTML={{ __html: markdownContent.trim() }} />
  );

  return markdownDiv;
}

const getStyles = (theme: GrafanaTheme2, align: FieldTextAlignment | undefined) => ({
  markdownOverrides: css({
    textAlign: align !== 'auto' ? align : undefined,
    '& ol, & ul': {
      paddingLeft: '1.5em',
    },
    '& p': {
      whiteSpace: 'pre-line',
    },
    '& a': {
      color: theme.colors.primary.text,
    },
    '& > *:last-child': {
      marginBottom: 0,
    },
  }),
});
