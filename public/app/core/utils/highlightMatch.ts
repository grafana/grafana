/**
 * Wraps the first occurrence of query in text with <mark> tags for highlighting.
 * Only the first match is highlighted. Matching is case-insensitive.
 * Returns the original text if query is empty or not found.
 *
 * Note: Returns a raw HTML string — callers are responsible for safe rendering.
 * For React rendering, use HighlightedLabel in SearchableList instead.
 */
export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return text;
  }

  return (
    text.slice(0, index) +
    '<mark>' +
    text.slice(index, index + lowerQuery.length) +
    '</mark>' +
    text.slice(index + lowerQuery.length)
  );
}
