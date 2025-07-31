import { renderMarkdown, formattedValueToString } from '@grafana/data';

import { MaybeWrapWithLink } from '../MaybeWrapWithLink';
import { MarkdownCellProps } from '../types';

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
