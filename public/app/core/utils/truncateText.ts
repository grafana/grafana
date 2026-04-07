/**
 * Truncates a string to the specified maximum length, appending an ellipsis if truncated.
 * Returns an empty string if text is empty or maxLength is zero or negative.
 *
 * Note: maxLength is measured in UTF-16 code units (i.e. String.length), not visual characters.
 * Strings containing surrogate pairs (e.g. emoji) may be counted differently than expected.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || maxLength <= 0) {
    return '';
  }

  if (text.length > maxLength) {
    return text.slice(0, maxLength - 1) + '…';
  }

  return text;
}
