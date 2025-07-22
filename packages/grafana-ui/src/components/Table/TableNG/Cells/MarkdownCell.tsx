import { css } from '@emotion/css';

import { GrafanaTheme2, renderMarkdown, formattedValueToString } from '@grafana/data';
import { FieldTextAlignment } from '@grafana/schema';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { MaybeWrapWithLink } from '../MaybeWrapWithLink';
import { MarkdownCellProps } from '../types';

export function MarkdownCell({ field, rowIdx, disableSanitizeHtml }: MarkdownCellProps) {
  const value = field.values[rowIdx];
  const align: FieldTextAlignment | undefined = field.config?.custom?.align;
  const styles = useStyles2(getStyles, align);

  const markdownContent =
    typeof value === 'string'
      ? renderMarkdown(value, { noSanitize: disableSanitizeHtml })
      : formattedValueToString(field.display!(value));

  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      <div className={styles.markdownOverrides} dangerouslySetInnerHTML={{ __html: markdownContent.trim() }} />
    </MaybeWrapWithLink>
  );
}

const getStyles = (theme: GrafanaTheme2, align: FieldTextAlignment | undefined) => ({
  markdownOverrides: css({
    textAlign: align !== 'auto' ? align : undefined,
    paddingBlock: theme.spacing(1),
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
