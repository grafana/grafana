export type CommandPaletteQueryLengthBucket = 'empty' | '1-3' | '4-10' | '11+';

/** Buckets palette query length for CUJ telemetry (never sends the raw query). */
export function bucketQueryLength(len: number): CommandPaletteQueryLengthBucket {
  if (len === 0) {
    return 'empty';
  }
  if (len <= 3) {
    return '1-3';
  }
  if (len <= 10) {
    return '4-10';
  }
  return '11+';
}
