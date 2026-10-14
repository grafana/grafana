import { type Criteria } from './criteria';
import { serializeLabelValue } from './labelMatcher';
import { TOKEN_KEYS } from './tokens';

/** Quotes a value if it contains whitespace, so it round-trips through the tokenizer as a
 * single token. */
export function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

function formatToken(key: string, value: string): string {
  return `${key}:${quoteIfNeeded(value)}`;
}

/**
 * Produces the canonical string form of a Criteria object. Token order is fixed (not the
 * order the user originally typed them in) so that repeated serialize() calls, and
 * parse(serialize(c)), are stable. See README.md for the exact syntax.
 */
export function serialize(criteria: Criteria): string {
  const parts: string[] = [];

  for (const namespace of criteria.namespaces) {
    parts.push(formatToken(TOKEN_KEYS.namespace, namespace));
  }
  for (const dataSourceUid of criteria.dataSourceUids) {
    parts.push(formatToken(TOKEN_KEYS.datasource, dataSourceUid));
  }
  // Unresolved migration entries keep their original (name, not UID) value, unchanged.
  for (const entry of criteria.unresolved) {
    const key = entry.key === 'namespace' ? TOKEN_KEYS.namespace : TOKEN_KEYS.datasource;
    parts.push(formatToken(key, entry.value));
  }
  for (const label of criteria.labels) {
    parts.push(formatToken(TOKEN_KEYS.label, serializeLabelValue(label)));
  }
  if (criteria.dashboardUid) {
    parts.push(formatToken(TOKEN_KEYS.dashboard, criteria.dashboardUid));
  }
  if (criteria.panelId) {
    parts.push(formatToken(TOKEN_KEYS.panelId, criteria.panelId));
  }
  if (criteria.contactPoint) {
    parts.push(formatToken(TOKEN_KEYS.contactPoint, criteria.contactPoint));
  }
  if (criteria.policy) {
    parts.push(formatToken(TOKEN_KEYS.policy, criteria.policy));
  }
  if (criteria.paused) {
    parts.push(formatToken(TOKEN_KEYS.paused, criteria.paused));
  }
  if (criteria.metric) {
    parts.push(formatToken(TOKEN_KEYS.metric, criteria.metric));
  }
  if (criteria.targetDataSourceUid) {
    parts.push(formatToken(TOKEN_KEYS.targetDatasource, criteria.targetDataSourceUid));
  }
  if (criteria.hidePluginRules) {
    parts.push(formatToken(TOKEN_KEYS.plugins, 'hide'));
  }
  if (criteria.state) {
    parts.push(formatToken(TOKEN_KEYS.state, criteria.state));
  }
  if (criteria.health) {
    parts.push(formatToken(TOKEN_KEYS.health, criteria.health));
  }
  for (const word of criteria.text) {
    parts.push(quoteIfNeeded(word));
  }

  return parts.join(' ');
}
