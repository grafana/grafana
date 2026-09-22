import { lazy, Suspense, useMemo } from 'react';

import { formattedValueToString } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { MaybeWrapWithLink } from '../components/MaybeWrapWithLink';
import { type TableCellRendererProps } from '../types';

const JsonSyntaxHighlight = lazy(() =>
  import('./JsonSyntaxHighlight').catch(() => ({ default: ({ text }: { text: string }) => <>{text}</> }))
);

export function JsonCell({
  value,
  field,
  rowIdx,
  cellOptions,
  theme,
  jsonSyntaxHighlightingEnabled,
}: TableCellRendererProps) {
  const text = formattedValueToString(field.display!(value));
  const enabled =
    jsonSyntaxHighlightingEnabled &&
    (cellOptions.type !== TableCellDisplayMode.JSONView || cellOptions.syntaxHighlighting !== false);
  const highlight = useMemo(() => {
    if (!enabled || text.length > 50_000) {
      return false;
    }
    try {
      // Prism also tokenizes invalid JSON, including ordinary monospace text.
      const parsed: unknown = JSON.parse(text);
      return parsed !== null && typeof parsed === 'object';
    } catch {
      return false;
    }
  }, [enabled, text]);

  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      {highlight ? (
        <span>
          <Suspense fallback={text}>
            <JsonSyntaxHighlight text={text} theme={theme} />
          </Suspense>
        </span>
      ) : (
        text
      )}
    </MaybeWrapWithLink>
  );
}
