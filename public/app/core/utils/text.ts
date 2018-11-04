import { TextMatch } from 'app/types/explore';

/**
 * Adapt findMatchesInText for react-highlight-words findChunks handler.
 * See https://github.com/bvaughn/react-highlight-words#props
 */
export function findHighlightChunksInText({ searchWords, textToHighlight }) {
  return findMatchesInText(textToHighlight, searchWords.join(' '));
}

/**
 * Returns a list of substring regexp matches.
 */
export function findMatchesInText(haystack: string, needle: string): TextMatch[] {
  // Empty search can send re.exec() into infinite loop, exit early
  if (!haystack || !needle) {
    return [];
  }
  const regexp = new RegExp(`(?:${needle})`, 'g');
  const matches = [];
  let match = regexp.exec(haystack);
  while (match) {
    matches.push({
      text: match[0],
      start: match.index,
      length: match[0].length,
      end: match.index + match[0].length,
    });
    match = regexp.exec(haystack);
  }
  return matches;
}
