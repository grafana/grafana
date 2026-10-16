import { isDefaultRoutingTreeName } from '@grafana/alerting/unstable';

import { type Criteria, DEFAULT_POLICY, HEALTH_VALUES, STATE_VALUES, createEmptyCriteria } from './criteria';
import { parseLabelValue } from './labelMatcher';
import { tokenize } from './tokenizer';
import { TOKEN_KEYS, type TokenDefinition, buildTokenRegistry } from './tokens';

export function parse(input: string, registry: TokenDefinition[]): Criteria {
  const byKey = buildTokenRegistry(registry);
  const criteria = createEmptyCriteria();
  const appliedSingleValueKeys = new Set<string>();

  for (const raw of tokenize(input)) {
    if (raw.key === null) {
      if (raw.value.length > 0) {
        criteria.text.push(raw.value);
      }
      continue;
    }

    const definition = byKey.get(raw.key);
    const incomplete = raw.value.length === 0 || (raw.quoted && !raw.closed);

    const isRepeat = !definition?.multiValue && appliedSingleValueKeys.has(raw.key);
    const applied = definition && !incomplete && !isRepeat && applyToken(criteria, raw.key, raw.value);

    if (applied) {
      appliedSingleValueKeys.add(raw.key);
    } else {
      criteria.invalid.push({ key: raw.key, raw: input.slice(raw.start, raw.end) });
    }
  }

  return criteria;
}

/** Returns false, leaving `criteria` untouched, when the token rejects `value`. */
function applyToken(criteria: Criteria, key: string, value: string): boolean {
  switch (key) {
    case TOKEN_KEYS.rule:
      criteria.text.push(value);
      return true;
    case TOKEN_KEYS.namespace:
      criteria.namespaces.push(value);
      return true;
    case TOKEN_KEYS.datasource:
      criteria.dataSourceUids.push(value);
      return true;
    case TOKEN_KEYS.label: {
      const matcher = parseLabelValue(value);
      if (matcher) {
        criteria.labels.push(matcher);
      }
      return Boolean(matcher);
    }
    case TOKEN_KEYS.plugins:
      if (value === 'hide') {
        criteria.hidePluginRules = true;
        return true;
      }
      return false;
    case TOKEN_KEYS.health: {
      const health = HEALTH_VALUES.find((candidate) => candidate === value.toLowerCase());
      if (health) {
        criteria.health = health;
      }
      return Boolean(health);
    }
    case TOKEN_KEYS.state: {
      const state = STATE_VALUES.find((candidate) => candidate === value.toLowerCase());
      if (state) {
        criteria.state = state;
      }
      return Boolean(state);
    }
    case TOKEN_KEYS.dashboard:
      criteria.dashboardUid = value;
      return true;
    case TOKEN_KEYS.panelId:
      criteria.panelId = value;
      return true;
    case TOKEN_KEYS.contactPoint:
      criteria.contactPoint = value;
      return true;
    case TOKEN_KEYS.policy:
      // The default tree's emitted name (`user-defined`) means the default policy, which no named-tree filter matches.
      criteria.policy = isDefaultRoutingTreeName(value) ? DEFAULT_POLICY : value;
      return true;
    case TOKEN_KEYS.paused:
      if (value === 'true' || value === 'false') {
        criteria.paused = value;
        return true;
      }
      return false;
    case TOKEN_KEYS.metric:
      criteria.metric = value;
      return true;
    case TOKEN_KEYS.targetDatasource:
      criteria.targetDataSourceUid = value;
      return true;
    default:
      return false;
  }
}
