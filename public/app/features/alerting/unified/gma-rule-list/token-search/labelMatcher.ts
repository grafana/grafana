import { type LabelMatcher } from './ruleSearchFilter';

/** Two-character operators first, and the earliest operator in the value wins (as legacy `parseMatcher`). */
const OPERATORS: Array<{ token: string; operator: LabelMatcher['operator'] }> = [
  { token: '=~', operator: 'regex' },
  { token: '!~', operator: 'notRegex' },
  { token: '!=', operator: 'notEqual' },
  { token: '=', operator: 'equal' },
];

/** Returns undefined for empty/unparseable input, which callers treat as an incomplete draft. */
export function parseLabelValue(raw: string): LabelMatcher | undefined {
  if (raw.length === 0) {
    return undefined;
  }

  // A leading `!` not part of `!=`/`!~` means absence.
  if (raw[0] === '!' && raw[1] !== '=' && raw[1] !== '~') {
    const key = raw.slice(1);
    return key.length > 0 ? { key, operator: 'absent' } : undefined;
  }

  const found = OPERATORS.map((op) => ({ ...op, idx: raw.indexOf(op.token) }))
    .filter((op) => op.idx > -1)
    .sort((a, b) => a.idx - b.idx)[0];

  if (!found) {
    return { key: raw, operator: 'exists' };
  }

  const key = raw.slice(0, found.idx);
  const value = raw.slice(found.idx + found.token.length);
  if (key.length === 0) {
    return undefined;
  }
  return { key, operator: found.operator, value };
}

export function serializeLabelValue(matcher: LabelMatcher): string {
  switch (matcher.operator) {
    case 'exists':
      return matcher.key;
    case 'absent':
      return `!${matcher.key}`;
    case 'equal':
      return `${matcher.key}=${matcher.value ?? ''}`;
    case 'notEqual':
      return `${matcher.key}!=${matcher.value ?? ''}`;
    case 'regex':
      return `${matcher.key}=~${matcher.value ?? ''}`;
    case 'notRegex':
      return `${matcher.key}!~${matcher.value ?? ''}`;
  }
}
