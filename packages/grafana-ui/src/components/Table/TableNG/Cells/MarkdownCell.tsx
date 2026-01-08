import { css } from '@emotion/css';

import { renderMarkdown } from '@grafana/data';

import { MaybeWrapWithLink } from '../components/MaybeWrapWithLink';
import { getActiveCellSelector } from '../styles';
import { MarkdownCellProps, TableCellStyles } from '../types';

export function MarkdownCell({ field, rowIdx, disableSanitizeHtml }: MarkdownCellProps) {
  const rawValue = field.values[rowIdx];
  if (rawValue == null) {
    return null;
  }

  const renderValue = field.display!(rawValue);

  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      <div
        className="markdown-container"
        dangerouslySetInnerHTML={{
          __html: renderMarkdown(renderValue.text, { noSanitize: disableSanitizeHtml }).trim(),
        }}
      />
    </MaybeWrapWithLink>
  );
}

export const getStyles: TableCellStyles = (theme, { maxHeight }) =>
  css({
    [`&, ${getActiveCellSelector(Boolean(maxHeight))}`]: {
      whiteSpace: 'normal',
    },

    '.markdown-container': {
      width: '100%',
      // for elements like `p`, `h*`, etc. which have an inherent margin,
      // we want to remove the bottom margin for the last one in the container.
      '> *:last-child': {
        marginBottom: 0,
      },
    },

    'ol, ul': {
      paddingLeft: theme.spacing(2.5),
    },
    p: {
      whiteSpace: 'pre-line',
    },
  });
