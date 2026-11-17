import { type RuleSearchSchema } from './filterDefinitions';
import { type SharedRuleFilter } from './sharedRuleFilter';
import { type RawToken, tokenize } from './tokenizer';

/**
 * Replaces one filter's tokens with `values` where its first token was, or at the end when it has none; no values
 * removes it. Every other token is written back in its typed order. `rule` stands for the title text, so it replaces
 * the free text with `values` as words.
 */
export function setFilterValues<Filter extends SharedRuleFilter, Key extends string>(
  query: string,
  schema: RuleSearchSchema<Filter, Key>,
  key: Key,
  values: string[]
): string {
  const pageKeys = new Set<string>(schema.filters.map((definition) => definition.key));
  const isOwned = (token: RawToken) =>
    key === 'rule' ? token.key === null || token.key === 'rule' || !pageKeys.has(token.key) : token.key === key;
  const replacement = values
    .flatMap((value) => (key === 'rule' ? value.split(/\s+/) : [value]))
    .filter((value) => value.length > 0)
    .map((value) => formatToken({ key: key === 'rule' ? null : key, value, closed: true }));

  const out: string[] = [];
  let placed = false;
  for (const token of tokenize(query)) {
    if (!isOwned(token)) {
      out.push(formatToken(token));
    } else if (!placed) {
      out.push(...replacement);
      placed = true;
    }
  }
  if (!placed) {
    out.push(...replacement);
  }
  return out.join(' ');
}

// shortcut: a value with a double quote can't be written, since the syntax has no escapes; add one if users need it.
function formatToken({ key, value, closed }: RawToken): string {
  const prefix = key === null ? '' : `${key}:`;
  if (!closed) {
    return `${prefix}"${value}`;
  }
  const bare = prefix + value;
  const [read] = tokenize(bare);
  return read?.key === key && read.value === value ? bare : `${prefix}"${value}"`;
}
