import { isDefaultRoutingTreeName } from '@grafana/alerting/unstable';

import { parseLabelValue } from './labelMatcher';
import {
  DEFAULT_POLICY,
  HEALTH_VALUES,
  type RuleSearchFilter,
  STATE_VALUES,
  createEmptyFilter,
} from './ruleSearchFilter';
import { tokenize } from './tokenizer';
import { TOKEN_KEYS, type TokenDefinition, buildTokenRegistry } from './tokens';

export function parse(input: string, registry: TokenDefinition[]): RuleSearchFilter {
  const byKey = buildTokenRegistry(registry);
  const filter = createEmptyFilter();
  const appliedSingleValueKeys = new Set<string>();

  for (const raw of tokenize(input)) {
    if (raw.key === null) {
      if (raw.value.length > 0) {
        filter.text.push(raw.value);
      }
      continue;
    }

    const definition = byKey.get(raw.key);
    const incomplete = raw.value.length === 0 || (raw.quoted && !raw.closed);

    const isRepeat = !definition?.multiValue && appliedSingleValueKeys.has(raw.key);
    const applied = definition && !incomplete && !isRepeat && applyToken(filter, raw.key, raw.value);

    if (applied) {
      appliedSingleValueKeys.add(raw.key);
    } else {
      filter.invalid.push({ key: raw.key, raw: input.slice(raw.start, raw.end) });
    }
  }

  return filter;
}

/** Returns false, leaving `filter` untouched, when the token rejects `value`. */
function applyToken(filter: RuleSearchFilter, key: string, value: string): boolean {
  switch (key) {
    case TOKEN_KEYS.rule:
      filter.text.push(value);
      return true;
    case TOKEN_KEYS.namespace:
      filter.namespaces.push(value);
      return true;
    case TOKEN_KEYS.datasource:
      filter.dataSourceUids.push(value);
      return true;
    case TOKEN_KEYS.label: {
      const matcher = parseLabelValue(value);
      if (matcher) {
        filter.labels.push(matcher);
      }
      return Boolean(matcher);
    }
    case TOKEN_KEYS.plugins:
      if (value === 'hide') {
        filter.hidePluginRules = true;
        return true;
      }
      return false;
    case TOKEN_KEYS.health: {
      const health = HEALTH_VALUES.find((candidate) => candidate === value.toLowerCase());
      if (health) {
        filter.health = health;
      }
      return Boolean(health);
    }
    case TOKEN_KEYS.state: {
      const state = STATE_VALUES.find((candidate) => candidate === value.toLowerCase());
      if (state) {
        filter.state = state;
      }
      return Boolean(state);
    }
    case TOKEN_KEYS.dashboard:
      filter.dashboardUid = value;
      return true;
    case TOKEN_KEYS.panelId:
      filter.panelId = value;
      return true;
    case TOKEN_KEYS.contactPoint:
      filter.contactPoint = value;
      return true;
    case TOKEN_KEYS.policy:
      // The default tree's emitted name (`user-defined`) means the default policy, which no named-tree filter matches.
      filter.policy = isDefaultRoutingTreeName(value) ? DEFAULT_POLICY : value;
      return true;
    case TOKEN_KEYS.paused:
      if (value === 'true' || value === 'false') {
        filter.paused = value;
        return true;
      }
      return false;
    case TOKEN_KEYS.metric:
      filter.metric = value;
      return true;
    case TOKEN_KEYS.targetDatasource:
      filter.targetDataSourceUid = value;
      return true;
    default:
      return false;
  }
}
