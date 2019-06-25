import { TextMatch } from 'app/types/explore';
import xss from 'xss';

/**
 * Adapt findMatchesInText for react-highlight-words findChunks handler.
 * See https://github.com/bvaughn/react-highlight-words#props
 */
export function findHighlightChunksInText({ searchWords, textToHighlight }) {
  return searchWords.reduce((acc, term) => [...acc, ...findMatchesInText(textToHighlight, term)], []);
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
 * Converts any mode modifers in the text to the Javascript equivalent flag
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

const XSSWL = Object.keys(xss.whiteList).reduce((acc, element) => {
  acc[element] = xss.whiteList[element].concat(['class', 'style']);
  return acc;
}, {});

const sanitizeXSS = new xss.FilterXSS({
  whiteList: XSSWL,
});

/**
 * Returns string safe from XSS attacks.
 *
 * Even though we allow the style-attribute, there's still default filtering applied to it
 * Info: https://github.com/leizongmin/js-xss#customize-css-filter
 * Whitelist: https://github.com/leizongmin/js-css-filter/blob/master/lib/default.js
 */
export function sanitize(unsanitizedString: string): string {
  try {
    return sanitizeXSS.process(unsanitizedString);
  } catch (error) {
    console.log('String could not be sanitized', unsanitizedString);
    return unsanitizedString;
  }
}

export function hasAnsiCodes(input: string): boolean {
  return /\u001b\[\d{1,2}m/.test(input);
}

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
