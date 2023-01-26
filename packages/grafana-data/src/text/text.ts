export interface TextMatch {
  text: string;
  start: number;
  length: number;
  end: number;
}

/**
 * Adapt findMatchesInText for react-highlight-words findChunks handler.
 * See https://github.com/bvaughn/react-highlight-words#props
 */
export function findHighlightChunksInText({
  searchWords,
  textToHighlight,
}: {
  searchWords: Array<string | RegExp>;
  textToHighlight: string;
}) {
  const chunks: TextMatch[] = [];
  for (const term of searchWords) {
    chunks.push(...findMatchesInText(textToHighlight, term as string));
  }
  return chunks;
}

const cleanNeedle = (needle: string): string => {
  return needle.replace(/[[{(][\w,.\/:;<=>?:*+]+$/, '');
};

/**
 * Returns a list of substring regexp matches.
 */
export function findMatchesInText(haystack: string, needle: string): TextMatch[] {
  // Empty search can send re.exec() into infinite loop, exit early
  if (!haystack || !needle) {
    return [];
  }

  const matches: TextMatch[] = [];
  const { cleaned, flags } = parseFlags(cleanNeedle(needle));
  let regexp: RegExp;

  try {
    regexp = new RegExp(`(?:${cleaned})`, flags);
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

const CLEAR_FLAG = '-';
const FLAGS_REGEXP = /\(\?([ims-]+)\)/g;

/**
 * Converts any mode modifiers in the text to the Javascript equivalent flag
 */
export function parseFlags(text: string): { cleaned: string; flags: string } {
  const flags: Set<string> = new Set(['g']);

  const cleaned = text.replace(FLAGS_REGEXP, (str, group) => {
    const clearAll = group.startsWith(CLEAR_FLAG);

    for (let i = 0; i < group.length; ++i) {
      const flag = group.charAt(i);
      if (clearAll || group.charAt(i - 1) === CLEAR_FLAG) {
        flags.delete(flag);
      } else if (flag !== CLEAR_FLAG) {
        flags.add(flag);
      }
    }
    return ''; // Remove flag from text
  });

  return {
    cleaned: cleaned,
    flags: Array.from(flags).join(''),
  };
}
