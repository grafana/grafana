import { type RuleSearchSchema } from './filterDefinitions';
import { type SharedRuleFilter } from './sharedRuleFilter';
import { type RawToken, tokenize } from './tokenizer';

/**
 * Replaces one filter's tokens in the typed query with `values`, leaving every other token and the text between
 * them as typed. The new tokens take the place of the filter's first token, or go at the end when it has none;
 * no values removes the filter. `rule` stands for the title text, so it replaces the free text with `values` as words.
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
    .map((value) => (key === 'rule' ? formatText(value) : formatFilter(key, value)))
    .filter((token) => token.length > 0)
    .join(' ');

  let result = '';
  let cursor = 0;
  let pending = replacement.length > 0;
  for (const token of tokenize(query)) {
    if (!isOwned(token)) {
      continue;
    }
    const before = query.slice(cursor, token.start);
    if (pending) {
      result += before + replacement;
      pending = false;
      cursor = token.end;
    } else if ((result + before).trim().length === 0) {
      // A removed leading token takes the whitespace after it, so the query doesn't start with a gap.
      result += before;
      cursor = skipWhitespace(query, token.end);
    } else {
      result += before.trimEnd();
      cursor = token.end;
    }
  }
  result += query.slice(cursor);

  if (pending) {
    return result.length === 0 || /\s$/.test(result) ? result + replacement : `${result} ${replacement}`;
  }
  return result;
}

function formatText(text: string): string {
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => (readsBack(word, null, word) ? word : `"${word}"`))
    .join(' ');
}

// shortcut: a value with a double quote can't be written, since the syntax has no escapes; add one if users need it.
function formatFilter(key: string, value: string): string {
  if (value.length === 0) {
    return '';
  }
  const bare = `${key}:${value}`;
  return readsBack(bare, key, value) ? bare : `${key}:"${value}"`;
}

/** Whether `text` reads back as the single token it was written for. */
function readsBack(text: string, key: string | null, value: string): boolean {
  const tokens = tokenize(text);
  return tokens.length === 1 && tokens[0].key === key && tokens[0].value === value && tokens[0].closed;
}

function skipWhitespace(text: string, from: number): number {
  let i = from;
  while (i < text.length && /\s/.test(text[i])) {
    i++;
  }
  return i;
}
