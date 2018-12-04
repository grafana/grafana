import { TextMatch } from 'app/types/explore';

/**
 * Adapt findMatchesInText for react-highlight-words findChunks handler.
 * See https://github.com/bvaughn/react-highlight-words#props
 */
export function findHighlightChunksInText({ searchWords, textToHighlight }) {
  return findMatchesInText(textToHighlight, searchWords.join(' '));
}

const cleanNeedle = (needle: string): string => {
  return needle.replace(/[[{(][\w,.-?:*+]+$/, '');
};

/**
 * Returns a list of substring regexp matches.
 */
export function findMatchesInText(haystack: string, needle: string): TextMatch[] {
  // Empty search can send re.exec() into infinite loop, exit early
  if (!haystack || !needle) {
    return [];
  }
  const matches = [];
  const cleaned = cleanNeedle(needle);
  let regexp;
  try {
    regexp = new RegExp(`(?:${cleaned})`, 'g');
  } catch (error) {
    return matches;
  }
  haystack.replace(regexp, (substring, ...rest) => {
    if (substring) {
      const offset = rest[rest.length - 2];
      matches.push({
        text: substring,
        start: offset,
        length: substring.length,
        end: offset + substring.length,
      });
    }
    return '';
  });
  return matches;
}
