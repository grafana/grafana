/**
 * Lexer and parser for Pyroscope/PromQL label selectors with UTF-8 support.
 *
 * Label selectors have the form: {name="value", "utf8.name"="value", ...}
 * Label names that contain characters outside [a-zA-Z_][a-zA-Z0-9_]* must be
 * double-quoted, with backslash-escaping for `"` and `\` within.
 */

export type TokenKind = 'name' | 'quoted' | 'op' | 'comma' | 'lbrace' | 'rbrace' | 'unknown';
export type Token = { kind: TokenKind; value: string };

/**
 * Tokenise a label selector string (with or without surrounding braces).
 */
export function lex(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    if (ch === '{') {
      tokens.push({ kind: 'lbrace', value: '{' });
      i++;
      continue;
    }

    if (ch === '}') {
      tokens.push({ kind: 'rbrace', value: '}' });
      i++;
      continue;
    }

    if (ch === ',') {
      tokens.push({ kind: 'comma', value: ',' });
      i++;
      continue;
    }

    if (ch === '"') {
      i++;
      let s = '';
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < input.length) {
          s += input[i + 1];
          i += 2;
        } else {
          s += input[i++];
        }
      }
      i++; // closing quote
      tokens.push({ kind: 'quoted', value: s });
      continue;
    }

    if (ch === '=' || ch === '!') {
      let op = ch;
      i++;
      if (i < input.length && (input[i] === '=' || input[i] === '~')) {
        op += input[i++];
      }
      tokens.push({ kind: 'op', value: op });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let name = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        name += input[i++];
      }
      tokens.push({ kind: 'name', value: name });
      continue;
    }

    // Consume entire word-like sequence starting with a non-name char (e.g. "0invalid") as unknown
    if (/[0-9]/.test(ch)) {
      let word = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        word += input[i++];
      }
      tokens.push({ kind: 'unknown', value: word });
      continue;
    }

    tokens.push({ kind: 'unknown', value: ch });
    i++;
  }

  return tokens;
}

export interface LabelMatcher {
  name: string;
  operator: string;
  value: string;
}

/**
 * Parse a label selector string into an array of label matchers.
 * Accepts input with or without surrounding braces.
 */
export function parseSelector(input: string): LabelMatcher[] {
  const tokens = lex(input);
  const results: LabelMatcher[] = [];
  let i = 0;

  while (i < tokens.length) {
    // Skip braces and commas
    if (tokens[i].kind === 'lbrace' || tokens[i].kind === 'rbrace' || tokens[i].kind === 'comma') {
      i++;
      continue;
    }

    const nameToken = tokens[i];
    const opToken = tokens[i + 1];
    const valueToken = tokens[i + 2];

    if (
      (nameToken?.kind === 'name' || nameToken?.kind === 'quoted') &&
      opToken?.kind === 'op' &&
      valueToken?.kind === 'quoted'
    ) {
      results.push({
        name: nameToken.value,
        operator: opToken.value,
        value: valueToken.value,
      });
      i += 3;
    } else {
      i++;
    }
  }

  return results;
}

/**
 * Returns the label name quoted in double-quotes if it contains characters
 * outside [a-zA-Z_][a-zA-Z0-9_]*. Safe names are returned unchanged.
 *
 * Uses the lexer as the single source of truth for what constitutes
 * a valid unquoted label name.
 */
export function formatLabelName(name: string): string {
  const tokens = lex(name);
  if (tokens.length === 1 && tokens[0].kind === 'name') {
    return name;
  }
  return `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
