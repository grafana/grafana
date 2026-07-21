import { formattedValueToString, getValueFormat } from '@grafana/data';

// Browser locale is the deliberate choice: the homepage number format follows the user's environment.
export const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

/** Format a byte count as a compact SI string, e.g. "47 GB", "76 TB". */
export function formatBytesCompact(bytes: number): string {
  return formattedValueToString(getValueFormat('decbytes')(bytes, 0));
}
