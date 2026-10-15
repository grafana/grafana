import { type RawToken } from './tokens';

const KEY_PATTERN = /^([A-Za-z][A-Za-z0-9_-]*):/;

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
  let i = 0;

  while (i < input.length) {
    if (isWhitespace(input[i])) {
      i++;
      continue;
    }

    const start = i;
    // A colon with no valid key before it just becomes part of a free-text word, e.g. "1:2:3".
    const key = KEY_PATTERN.exec(input.slice(i))?.[1] ?? null;
    if (key !== null) {
      i += key.length + 1;
    }

    if (input[i] === '"') {
      const { text, closed, next } = readQuoted(input, i);
      tokens.push({ key, value: text, quoted: true, closed, start, end: next });
      i = next;
    } else {
      let end = i;
      while (end < input.length && !isWhitespace(input[end])) {
        end++;
      }
      tokens.push({ key, value: input.slice(i, end), quoted: false, closed: true, start, end });
      i = end;
    }
  }

  return tokens;
}
