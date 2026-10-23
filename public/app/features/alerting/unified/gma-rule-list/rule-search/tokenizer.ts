/** `key === null` marks free text. The span lets an invalid token be kept exactly as typed. */
export interface RawToken {
  key: string | null;
  value: string;
  /** False only for a quoted value with no closing quote. */
  closed: boolean;
  start: number;
  end: number;
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
    const key = readKey(input.slice(i));
    if (key !== null) {
      i += key.length + 1;
    }

    if (input[i] === '"') {
      const { text, closed, next } = readQuoted(input, i);
      tokens.push({ key, value: text, closed, start, end: next });
      i = next;
    } else {
      let end = i;
      while (end < input.length && !isWhitespace(input[end])) {
        end++;
      }
      tokens.push({ key, value: input.slice(i, end), closed: true, start, end });
      i = end;
    }
  }

  return tokens;
}

/** The key unquoted `text` would be read with, or null when it has none. */
export function readKey(text: string): string | null {
  return KEY_PATTERN.exec(text)?.[1] ?? null;
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/** `closed` is false for an unterminated quote, which is kept as a draft. */
function readQuoted(input: string, openIndex: number): { text: string; closed: boolean; next: number } {
  const closeIndex = input.indexOf('"', openIndex + 1);
  if (closeIndex === -1) {
    return { text: input.slice(openIndex + 1), closed: false, next: input.length };
  }
  return { text: input.slice(openIndex + 1, closeIndex), closed: true, next: closeIndex + 1 };
}

const KEY_PATTERN = /^([A-Za-z][A-Za-z0-9_-]*):/;
