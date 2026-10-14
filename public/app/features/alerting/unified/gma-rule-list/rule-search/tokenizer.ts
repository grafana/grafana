import { type RawToken } from './tokens';

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/** Reads a `"..."` value starting at `openIndex` (which must be a `"`). Returns the
 * unquoted text and whether the closing quote was found, so an unterminated quote (still
 * being typed) can be preserved as a draft rather than silently swallowed. */
function readQuoted(input: string, openIndex: number): { text: string; closed: boolean; next: number } {
  let i = openIndex + 1;
  while (i < input.length && input[i] !== '"') {
    i++;
  }
  const text = input.slice(openIndex + 1, i);
  if (i < input.length) {
    return { text, closed: true, next: i + 1 };
  }
  return { text, closed: false, next: i };
}

/**
 * Splits a flat search string into free-text and `key:value` tokens, preserving source
 * spans and never dropping malformed/unfinished input — see README.md for the exact syntax.
 */
export function tokenize(input: string): RawToken[] {
  const tokens: RawToken[] = [];
  const len = input.length;
  let i = 0;

  while (i < len) {
    while (i < len && isWhitespace(input[i])) {
      i++;
    }
    if (i >= len) {
      break;
    }

    const start = i;

    if (input[i] === '"') {
      const { text, closed, next } = readQuoted(input, i);
      tokens.push({ key: null, value: text, quoted: true, closed, start, end: next });
      i = next;
      continue;
    }

    // Look ahead for `key:` before the next whitespace.
    let j = i;
    while (j < len && input[j] !== ':' && !isWhitespace(input[j])) {
      j++;
    }

    let key: string | null = null;
    if (j < len && input[j] === ':') {
      const candidate = input.slice(i, j);
      if (KEY_PATTERN.test(candidate)) {
        key = candidate;
      }
    }

    if (key !== null) {
      i = j + 1;
      if (i < len && input[i] === '"') {
        const { text, closed, next } = readQuoted(input, i);
        tokens.push({ key, value: text, quoted: true, closed, start, end: next });
        i = next;
      } else {
        let k = i;
        while (k < len && !isWhitespace(input[k])) {
          k++;
        }
        tokens.push({ key, value: input.slice(i, k), quoted: false, closed: true, start, end: k });
        i = k;
      }
      continue;
    }

    // Free-text word: read to the next whitespace (a colon with no valid key just becomes
    // part of the word, e.g. "1:2:3").
    let k = i;
    while (k < len && !isWhitespace(input[k])) {
      k++;
    }
    tokens.push({ key: null, value: input.slice(i, k), quoted: false, closed: true, start, end: k });
    i = k;
  }

  return tokens;
}
