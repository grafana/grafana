import { useRef } from 'react';

/**
 * Turns the cascade delete controller's raw "direct children not yet deleted" count into a 0-100
 * percentage, for a determinate progress bar instead of a purely indeterminate spinner.
 *
 * The controller only ever reports the current remaining count, not the original size of the
 * subtree, so the first non-zero count observed is remembered as the starting total. If a later
 * pass reports a higher count than that (e.g. a resync re-lists children before this one's own
 * delete calls land), the total is bumped up to match rather than letting progress go negative.
 */
export function useCascadeDeleteProgress(remaining: number | undefined): number | undefined {
  const totalRef = useRef<number | undefined>(undefined);

  if (remaining === undefined) {
    return undefined;
  }
  if (totalRef.current === undefined || remaining > totalRef.current) {
    totalRef.current = remaining;
  }
  if (totalRef.current === 0) {
    return 100;
  }
  return Math.round(((totalRef.current - remaining) / totalRef.current) * 100);
}
