import { type RawToken } from './tokens';

const KEY_PATTERN = /^([A-Za-z][A-Za-z0-9_-]*):/;

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/** `closed` is false for an unterminated quote, which is kept as a draft. */
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

export function tokenize(input: string): RawToken[] {
  const tokens: RawToken[] = [];
  let i = 0;

  while (i < input.length) {
    if (isWhitespace(input[i])) {
      i++;
      continue;
    }

    const start = i;
    // A colon with no valid key before it stays in the free-text word, e.g. "1:2:3".
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
