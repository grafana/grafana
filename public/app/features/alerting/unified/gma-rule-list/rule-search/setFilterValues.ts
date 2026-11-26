import { type RuleSearchSchema } from './filterDefinitions';
import { type SharedRuleFilter } from './sharedRuleFilter';
import { type RawToken, tokenize } from './tokenizer';

/**
 * Replaces the `filterKey` filter in `searchQuery` with `newValues`, keeping every other token in its typed order,
 * e.g. `cpu state:firing label:team=api` with `state` → `['pending']` gives `cpu state:pending label:team=api`.
 * The new tokens go where the filter's first token was, or at the end when the query has none. No values removes
 * the filter.
 */
export function setFilterValues<Filter extends SharedRuleFilter, Key extends string>(
  searchQuery: string,
  searchSchema: RuleSearchSchema<Filter, Key>,
  filterKey: Key,
  newValues: string[]
): string {
  const pageKeys = new Set<string>(searchSchema.filters.map((definition) => definition.key));
  const isThisFilter = (token: RawToken) => belongsToFilter(token, filterKey, pageKeys);

  const tokens = tokenize(searchQuery);
  const otherTokens = tokens.filter((token) => !isThisFilter(token));
  // Every token before the filter's first one is kept, so its index is also its place among the kept tokens.
  const firstIndex = tokens.findIndex(isThisFilter);
  const insertAt = firstIndex === -1 ? otherTokens.length : firstIndex;

  return [...otherTokens.slice(0, insertAt), ...toTokens(filterKey, newValues), ...otherTokens.slice(insertAt)]
    .map(formatToken)
    .join(' ');
}

/** `setFilterValues` for each changed filter. An undefined value is dropped, so `[undefined]` removes the filter. */
export function setFilters<Filter extends SharedRuleFilter, Key extends string>(
  searchQuery: string,
  searchSchema: RuleSearchSchema<Filter, Key>,
  changes: Partial<Record<Key, Array<string | undefined>>>
): string {
  return searchSchema.filters.reduce((query, { key }) => {
    const values = changes[key];
    return values
      ? setFilterValues(
          query,
          searchSchema,
          key,
          values.filter((value) => value !== undefined)
        )
      : query;
  }, searchQuery);
}

/** The rule name is all the title text: free text, `rule:` and keys the page has no filter for. */
function belongsToFilter(token: RawToken, filterKey: string, pageKeys: Set<string>): boolean {
  if (filterKey !== 'rule') {
    return token.key === filterKey;
  }
  return token.key === null || token.key === 'rule' || !pageKeys.has(token.key);
}

/** The rule name becomes free-text words; any other filter gets one token per value. */
function toTokens(filterKey: string, newValues: string[]): RawToken[] {
  if (filterKey === 'rule') {
    const words = newValues.flatMap((value) => value.split(/\s+/)).filter((word) => word.length > 0);
    return words.map((word) => ({ key: null, value: word, closed: true }));
  }
  return newValues.filter((value) => value.length > 0).map((value) => ({ key: filterKey, value, closed: true }));
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
