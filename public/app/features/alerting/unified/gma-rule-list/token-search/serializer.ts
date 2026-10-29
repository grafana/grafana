import { serializeLabelValue } from './labelMatcher';
import { type RuleSearchFilter } from './ruleSearchFilter';
import { TOKEN_KEYS } from './tokens';

export function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

function formatToken(key: string, value: string): string {
  return `${key}:${quoteIfNeeded(value)}`;
}

/** Token order is fixed, not as typed, so serialize and parse(serialize(c)) are stable. */
export function serialize(filter: RuleSearchFilter): string {
  const parts: string[] = [];

  for (const namespace of filter.namespaces) {
    parts.push(formatToken(TOKEN_KEYS.namespace, namespace));
  }
  for (const dataSourceUid of filter.dataSourceUids) {
    parts.push(formatToken(TOKEN_KEYS.datasource, dataSourceUid));
  }
  for (const label of filter.labels) {
    parts.push(formatToken(TOKEN_KEYS.label, serializeLabelValue(label)));
  }
  if (filter.dashboardUid) {
    parts.push(formatToken(TOKEN_KEYS.dashboard, filter.dashboardUid));
  }
  if (filter.panelId) {
    parts.push(formatToken(TOKEN_KEYS.panelId, filter.panelId));
  }
  if (filter.contactPoint) {
    parts.push(formatToken(TOKEN_KEYS.contactPoint, filter.contactPoint));
  }
  if (filter.policy) {
    parts.push(formatToken(TOKEN_KEYS.policy, filter.policy));
  }
  if (filter.paused) {
    parts.push(formatToken(TOKEN_KEYS.paused, filter.paused));
  }
  if (filter.metric) {
    parts.push(formatToken(TOKEN_KEYS.metric, filter.metric));
  }
  if (filter.targetDataSourceUid) {
    parts.push(formatToken(TOKEN_KEYS.targetDatasource, filter.targetDataSourceUid));
  }
  if (filter.hidePluginRules) {
    parts.push(formatToken(TOKEN_KEYS.plugins, 'hide'));
  }
  if (filter.state) {
    parts.push(formatToken(TOKEN_KEYS.state, filter.state));
  }
  if (filter.health) {
    parts.push(formatToken(TOKEN_KEYS.health, filter.health));
  }
  for (const token of filter.invalid) {
    parts.push(token.raw);
  }
  for (const word of filter.text) {
    parts.push(quoteIfNeeded(word));
  }

  return parts.join(' ');
}
