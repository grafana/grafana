import { type LabelMatcher } from './criteria';

/** Ordered so two-character operators are matched before the single-character `=` they
 * contain, and so the earliest-occurring operator in the raw value wins (mirrors the
 * legacy `parseMatcher` behavior in unified/utils/matchers.ts). */
const OPERATORS: Array<{ token: string; operator: LabelMatcher['operator'] }> = [
  { token: '=~', operator: 'regex' },
  { token: '!~', operator: 'notRegex' },
  { token: '!=', operator: 'notEqual' },
  { token: '=', operator: 'equal' },
];

/**
 * Parses the value half of a `label:` token, e.g. `team=api`, `team!=api`, `team=~api.*`,
 * `team!~x`, `team` (exists), `!team` (absent). Returns undefined for empty/unparseable
 * input so callers can treat it as an incomplete draft rather than a matcher.
 */
export function parseLabelValue(raw: string): LabelMatcher | undefined {
  if (raw.length === 0) {
    return undefined;
  }

  // A leading `!` not already part of `!=`/`!~` denotes absence, e.g. `!team`.
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

/** Reverse of parseLabelValue: rebuilds the value half of a `label:` token from a matcher. */
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
