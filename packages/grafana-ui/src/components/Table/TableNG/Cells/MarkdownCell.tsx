import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useMemo, useState } from 'react';

import { renderMarkdown } from '@grafana/data';

import { MarkdownAdmonitions, MarkdownHTML } from '../../../Markdown/MarkdownHTML';
import { MaybeWrapWithLink } from '../components/MaybeWrapWithLink';
import { getActiveCellSelector, isTableCellStylesKeyEqual } from '../styles';
import { type MarkdownCellProps, type TableCellStyles } from '../types';

export function MarkdownCell({ field, rowIdx, disableSanitizeHtml }: MarkdownCellProps) {
  const rawValue = field.values[rowIdx];
  if (rawValue == null) {
    return null;
  }

  const renderValue = field.display!(rawValue);

  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      {disableSanitizeHtml ? (
        <UnsanitizedMarkdown key={renderValue.text} text={renderValue.text} />
      ) : (
        <MarkdownHTML className="markdown-container" html={renderMarkdown(renderValue.text).trim()} />
      )}
    </MaybeWrapWithLink>
  );
}

// Keep the administrator-controlled opt-out separate from the safe MarkdownHTML API.
function UnsanitizedMarkdown({ text }: { text: string }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const innerHtml = useMemo(() => ({ __html: renderMarkdown(text, { noSanitize: true }).trim() }), [text]);
  return (
    <>
      <div ref={setContainer} className="markdown-container" dangerouslySetInnerHTML={innerHtml} />
      <MarkdownAdmonitions container={container} />
    </>
  );
}

export const getStyles: TableCellStyles = memoize(
  (theme, { maxHeight }) =>
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
    }),
  { isMatchingKey: isTableCellStylesKeyEqual }
);
