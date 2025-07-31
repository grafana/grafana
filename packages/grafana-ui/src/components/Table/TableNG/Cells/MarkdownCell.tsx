import { css } from '@emotion/css';

import { renderMarkdown, formattedValueToString } from '@grafana/data';

import { MaybeWrapWithLink } from '../MaybeWrapWithLink';
import { MarkdownCellProps, TableCellStyles } from '../types';

export function MarkdownCell({ field, rowIdx, disableSanitizeHtml }: MarkdownCellProps) {
  const value = field.values[rowIdx];

  const markdownContent =
    typeof value === 'string'
      ? renderMarkdown(value, { noSanitize: disableSanitizeHtml })
      : formattedValueToString(field.display!(value));

  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      <div className="markdown-container" dangerouslySetInnerHTML={{ __html: markdownContent.trim() }} />
    </MaybeWrapWithLink>
  );
}

export const getStyles: TableCellStyles = (theme) =>
  css({
    '& ol, & ul': {
      paddingLeft: theme.spacing(1.5),
    },
    '& p': {
      whiteSpace: 'pre-line',
    },
    '& a': {
      color: theme.colors.primary.text,
    },
    // for elements like `p`, `h*`, etc. which have an inherent margin,
    // we want to remove the bottom margin for the last one in the container.
    '& > .markdown-container > *:last-child': {
      marginBottom: 0,
    },
  });
