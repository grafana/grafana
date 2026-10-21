import { type FilterDefinition, type FilterKey } from './filterDefinitions';
import { serializeLabelValue } from './labelMatcher';
import { type RuleSearchFilter } from './ruleSearchFilter';
import { readKey } from './tokenizer';

/**
 * Writes tokens in a fixed order, not as typed and not in help order, so equal filters give equal URLs
 * and `parse(serialize(filter))` returns `filter`.
 */
export function serialize(filter: RuleSearchFilter, filters: FilterDefinition[]): string {
  const keys = new Set(filters.map((definition) => definition.key));
  const parts: string[] = [];

  for (const folder of filter.folders) {
    parts.push(formatToken('folder', folder));
  }
  for (const dataSourceUid of filter.dataSourceUids) {
    parts.push(formatToken('datasource', dataSourceUid));
  }
  for (const label of filter.labels) {
    parts.push(formatToken('label', serializeLabelValue(label)));
  }
  if (filter.dashboardUid) {
    parts.push(formatToken('dashboard', filter.dashboardUid));
  }
  if (filter.panelId) {
    parts.push(formatToken('panelId', filter.panelId));
  }
  if (filter.contactPoint) {
    parts.push(formatToken('contactPoint', filter.contactPoint));
  }
  if (filter.policy) {
    parts.push(formatToken('policy', filter.policy));
  }
  if (filter.paused) {
    parts.push(formatToken('paused', filter.paused));
  }
  if (filter.metric) {
    parts.push(formatToken('metric', filter.metric));
  }
  if (filter.targetDataSourceUid) {
    parts.push(formatToken('targetDatasource', filter.targetDataSourceUid));
  }
  if (filter.hidePluginRules) {
    parts.push(formatToken('plugins', 'hide'));
  }
  if (filter.state) {
    parts.push(formatToken('state', filter.state));
  }
  if (filter.health) {
    parts.push(formatToken('health', filter.health));
  }
  for (const word of filter.text) {
    parts.push(formatText(word, keys));
  }
  // Last, because an unterminated quote reads to the end of the query and would take what follows.
  for (const token of filter.invalid) {
    parts.push(token.raw);
  }

  return parts.join(' ');
}

function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

function formatToken(key: FilterKey, value: string): string {
  return `${key}:${quoteIfNeeded(value)}`;
}

function formatText(word: string, keys: Set<string>): string {
  const key = readKey(word);
  // Unquoted, text such as `state:firing` would read back as a filter. A key the page doesn't know stays text.
  return key !== null && keys.has(key) ? `"${word}"` : quoteIfNeeded(word);
}
