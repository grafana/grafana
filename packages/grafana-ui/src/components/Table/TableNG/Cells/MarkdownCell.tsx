import { renderMarkdown } from '@grafana/data';

import { MaybeWrapWithLink } from '../MaybeWrapWithLink';
import { MarkdownCellProps } from '../types';

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
