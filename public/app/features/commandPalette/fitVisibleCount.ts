/** Finds the longest tag prefix that fits, retaining one shrinkable tag even when space is exhausted. */
export function fitVisibleCount(
  widths: readonly number[],
  countWidths: readonly number[],
  gap: number,
  availableWidth: number
): number {
  let width = 0;
  let count = Math.min(1, widths.length);

  for (let i = 0; i < widths.length; i++) {
    width += widths[i] + (i > 0 ? gap : 0);
    const hiddenCount = widths.length - i - 1;
    const requiredWidth = width + (hiddenCount > 0 ? gap + countWidths[hiddenCount - 1] : 0);
    if (requiredWidth <= availableWidth) {
      count = i + 1;
    }
  }

  return count;
}
