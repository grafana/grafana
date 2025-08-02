import { css } from '@emotion/css';

import { renderMarkdown } from '@grafana/data';

import { MaybeWrapWithLink } from '../MaybeWrapWithLink';
import { MarkdownCellProps, TableCellStyles } from '../types';

export function MarkdownCell({ field, rowIdx, disableSanitizeHtml }: MarkdownCellProps) {
  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      <div
        className="markdown-container"
        dangerouslySetInnerHTML={{
          __html: renderMarkdown(field.values[rowIdx], { noSanitize: disableSanitizeHtml }).trim(),
        }}
      />
    </MaybeWrapWithLink>
  );
}

export const getStyles: TableCellStyles = (theme) =>
  css({
    whiteSpace: 'normal',
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
