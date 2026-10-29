/** `key === null` marks free text. */
export interface RawToken {
  key: string | null;
  value: string;
  /** False when a quote has no closing quote; it then reads to the end of the input. */
  closed: boolean;
}

export function tokenize(input: string): RawToken[] {
  const tokens: RawToken[] = [];
  let i = 0;

  while (i < input.length) {
    if (isWhitespace(input[i])) {
      i++;
      continue;
    }

    // A colon with no valid key before it stays in the free-text word, e.g. "1:2:3".
    const key = readKey(input.slice(i));
    if (key !== null) {
      i += key.length + 1;
    }

    const { value, closed, next } = readValue(input, i);
    tokens.push({ key, value, closed });
    i = next;
  }

  return tokens;
}

function readKey(text: string): string | null {
  return KEY_PATTERN.exec(text)?.[1] ?? null;
}

// Includes the non-breaking space, which text copied from chat or documents often has instead of a space.
function isWhitespace(ch: string): boolean {
  return /\s/.test(ch);
}

/** Reads to the next whitespace outside quotes, dropping the quotes, so `label:team="a b"` reads as `team=a b`. */
function readValue(input: string, from: number): { value: string; closed: boolean; next: number } {
  let value = '';
  let i = from;
  while (i < input.length && !isWhitespace(input[i])) {
    if (input[i] !== '"') {
      value += input[i++];
      continue;
    }
    const closeIndex = input.indexOf('"', i + 1);
    if (closeIndex === -1) {
      return { value: value + input.slice(i + 1), closed: false, next: input.length };
    }
    value += input.slice(i + 1, closeIndex);
    i = closeIndex + 1;
  }
  return { value, closed: true, next: i };
}

const KEY_PATTERN = /^([A-Za-z][A-Za-z0-9_-]*):/;
