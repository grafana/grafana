/**
 * Truncates a string to the specified maximum length, appending an ellipsis if truncated.
 * Returns an empty string if text is empty or maxLength is zero or negative.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || maxLength <= 0) {
    return '';
  }

  if (text.length >= maxLength) {
    return text.slice(0, maxLength - 1) + '…';
  }

  return text;
}
