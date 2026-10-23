import { isDefaultRoutingTreeName } from '@grafana/alerting/unstable';

import { type FilterDefinition, type FilterKey, indexByKey } from './filterDefinitions';
import { parseLabelValue } from './labelMatcher';
import {
  DEFAULT_POLICY,
  HEALTH_API_VALUES,
  type HealthValue,
  type RuleSearchFilter,
  STATE_API_VALUES,
  type StateValue,
  createEmptyFilter,
} from './ruleSearchFilter';
import { tokenize } from './tokenizer';

export function parse(input: string, filters: FilterDefinition[]): RuleSearchFilter {
  const byKey = indexByKey(filters);
  const filter = createEmptyFilter();
  // A key counts as used only once a value was accepted, so `state:bogus state:firing` still applies `firing`.
  const usedSingleValueKeys = new Set<string>();

  for (const raw of tokenize(input)) {
    if (raw.key === null) {
      if (raw.value.length > 0) {
        filter.text.push(raw.value);
      }
      continue;
    }

    const definition = byKey.get(raw.key);
    // A key this page has no filter for is part of a title, e.g. a rule named `foo:bar`.
    if (definition === undefined) {
      filter.text.push(`${raw.key}:${raw.value}`);
      continue;
    }

    const isComplete = raw.value.length > 0 && raw.closed;
    const isRepeat = !definition.multiValue && usedSingleValueKeys.has(raw.key);
    const accepted = isComplete && !isRepeat && applyToken(filter, definition.key, raw.value);

    if (!accepted) {
      filter.invalid.push({ key: raw.key, raw: input.slice(raw.start, raw.end) });
    } else if (!definition.multiValue) {
      usedSingleValueKeys.add(raw.key);
    }
  }

  return filter;
}

/** Returns false, leaving `filter` untouched, when the token rejects `value`. */
function applyToken(filter: RuleSearchFilter, key: FilterKey, value: string): boolean {
  switch (key) {
    case 'rule':
      filter.text.push(value);
      return true;
    case 'folder':
      filter.folders.push(value);
      return true;
    case 'datasource':
      filter.dataSourceUids.push(value);
      return true;
    case 'label': {
      const matcher = parseLabelValue(value);
      if (matcher) {
        filter.labels.push(matcher);
      }
      return Boolean(matcher);
    }
    case 'plugins':
      if (value === 'hide') {
        filter.hidePluginRules = true;
        return true;
      }
      return false;
    case 'health': {
      const health = value.toLowerCase();
      if (isHealthValue(health)) {
        filter.health = health;
        return true;
      }
      return false;
    }
    case 'state': {
      const state = value.toLowerCase();
      if (isStateValue(state)) {
        filter.state = state;
        return true;
      }
      return false;
    }
    case 'dashboard':
      filter.dashboardUid = value;
      return true;
    case 'panelId':
      filter.panelId = value;
      return true;
    case 'contactPoint':
      filter.contactPoint = value;
      return true;
    case 'policy':
      // The default tree's emitted name (`user-defined`) means the default policy, which no named-tree filter matches.
      filter.policy = isDefaultRoutingTreeName(value) ? DEFAULT_POLICY : value;
      return true;
    case 'paused': {
      const paused = value.toLowerCase();
      if (paused === 'true' || paused === 'false') {
        filter.paused = paused;
        return true;
      }
      return false;
    }
    case 'metric':
      filter.metric = value;
      return true;
    case 'targetDatasource':
      filter.targetDataSourceUid = value;
      return true;
  }
}

function isStateValue(value: string): value is StateValue {
  return Object.hasOwn(STATE_API_VALUES, value);
}

function isHealthValue(value: string): value is HealthValue {
  return value === 'ok' || Object.hasOwn(HEALTH_API_VALUES, value);
}
