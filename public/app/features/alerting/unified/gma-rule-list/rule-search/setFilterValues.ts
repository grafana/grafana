import { type RuleSearchSchema } from './filterDefinitions';
import { type SharedRuleFilter } from './sharedRuleFilter';
import { type RawToken, tokenize } from './tokenizer';

/**
 * Replaces one filter in the query with `values`, keeping every other token in its typed order. The new tokens go
 * where the filter's first token was, or at the end when the query has none. No values removes the filter.
 */
export function setFilterValues<Filter extends SharedRuleFilter, Key extends string>(
  query: string,
  schema: RuleSearchSchema<Filter, Key>,
  key: Key,
  values: string[]
): string {
  const pageKeys = new Set<string>(schema.filters.map((definition) => definition.key));
  const isThisFilter = (token: RawToken) => belongsToFilter(token, key, pageKeys);

  const tokens = tokenize(query);
  const otherTokens = tokens.filter((token) => !isThisFilter(token));
  // Every token before the filter's first one is kept, so its index is also its place among the kept tokens.
  const firstIndex = tokens.findIndex(isThisFilter);
  const insertAt = firstIndex === -1 ? otherTokens.length : firstIndex;

  return [...otherTokens.slice(0, insertAt), ...toTokens(key, values), ...otherTokens.slice(insertAt)]
    .map(formatToken)
    .join(' ');
}

/** The rule name is all the title text: free text, `rule:` and keys the page has no filter for. */
function belongsToFilter(token: RawToken, key: string, pageKeys: Set<string>): boolean {
  if (key !== 'rule') {
    return token.key === key;
  }
  return token.key === null || token.key === 'rule' || !pageKeys.has(token.key);
}

/** The rule name becomes free-text words; any other filter gets one token per value. */
function toTokens(key: string, values: string[]): RawToken[] {
  if (key === 'rule') {
    const words = values.flatMap((value) => value.split(/\s+/)).filter((word) => word.length > 0);
    return words.map((word) => ({ key: null, value: word, closed: true }));
  }
  return values.filter((value) => value.length > 0).map((value) => ({ key, value, closed: true }));
}

// shortcut: a value with a double quote can't be written, since the syntax has no escapes; add one if users need it.
/** Writes a token so it reads back the same, quoting the value only when it would read differently bare. */
function formatToken({ key, value, closed }: RawToken): string {
  const prefix = key === null ? '' : `${key}:`;
  // Left unclosed, so the search still reports the quote.
  if (!closed) {
    return `${prefix}"${value}`;
  }
  const bare = prefix + value;
  return readsAs(bare, key, value) ? bare : `${prefix}"${value}"`;
}

/** False for a value with spaces, or a free-text word such as `state:firing` that would read as a filter. */
function readsAs(text: string, key: string | null, value: string): boolean {
  const [token] = tokenize(text);
  return token?.key === key && token.value === value;
}
