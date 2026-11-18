import { attempt, isError } from 'lodash';

import { t } from '@grafana/i18n';

import { parseMatcher } from '../../utils/matchers';

import { type FilterDefinition } from './filterDefinitions';
import {
  HEALTH_API_VALUES,
  type HealthValue,
  type SearchLabelMatcher,
  type SharedRuleFilter,
} from './sharedRuleFilter';

export type SharedFilterKey = 'rule' | 'folder' | 'datasource' | 'label' | 'plugins' | 'health';

/** The filters both pages support. */
export const sharedFilters = {
  rule: {
    key: 'rule',
    label: () => t('alerting.gma-rule-list.search.property.rule-name', 'Rule name'),
    description: () =>
      t('alerting.gma-rule-list.search.help.rule', 'Rule title text search (equivalent to free text).'),
    example: 'rule:cpu-high',
    apply: (filter, value) => {
      filter.text.push(value);
      return true;
    },
  },
  folder: {
    key: 'folder',
    label: () => t('alerting.gma-rule-list.search.property.folder', 'Folder'),
    description: () => t('alerting.gma-rule-list.search.help.folder', 'Folder (canonical value is the folder UID).'),
    example: 'folder:folder-uid',
    apply: (filter, value) => {
      filter.folders.push(value);
      return true;
    },
    feedback: (filter) => (filter.folders.some(hasWildcard) ? 'invalid' : undefined),
  },
  datasource: {
    key: 'datasource',
    label: () => t('alerting.gma-rule-list.search.property.datasource', 'Query data source'),
    description: () =>
      t(
        'alerting.gma-rule-list.search.help.datasource',
        'Query data source referenced by the rule (canonical value is the UID).'
      ),
    example: 'datasource:ds-uid',
    apply: (filter, value) => {
      filter.dataSourceUids.push(value);
      return true;
    },
    feedback: (filter) => (filter.dataSourceUids.some((uid) => !isQueryDatasourceUid(uid)) ? 'invalid' : undefined),
  },
  label: {
    key: 'label',
    label: () => t('alerting.gma-rule-list.search.property.labels', 'Labels'),
    description: () =>
      t(
        'alerting.gma-rule-list.search.help.label',
        'Label matcher: label:key (exists), label:!key (absent), label:key=value (equal), label:key!=value (not equal), label:key=~re (regex), label:key!~re (not regex). Quote a value with spaces: label:team="a b".'
      ),
    example: 'label:team=api',
    apply: (filter, value) => {
      const matcher = parseLabelValue(value);
      if (matcher) {
        filter.labels.push(matcher);
      }
      return Boolean(matcher);
    },
    feedback: (filter) => (filter.labels.some(isRejectedLabel) ? 'invalid' : undefined),
  },
  plugins: {
    key: 'plugins',
    label: () => t('alerting.gma-rule-list.search.property.plugins', 'Plugin rules'),
    description: () =>
      t('alerting.gma-rule-list.search.help.plugins', 'plugins:hide excludes rules created by plugins.'),
    example: 'plugins:hide',
    values: ['hide'],
    apply: (filter, value) => {
      if (value !== 'hide') {
        return false;
      }
      filter.hidePluginRules = true;
      return true;
    },
  },
  health: {
    key: 'health',
    label: () => t('alerting.gma-rule-list.search.property.health', 'Health'),
    description: () => t('alerting.gma-rule-list.search.help.health', 'Rule health: ok, nodata, error or unknown.'),
    example: 'health:error',
    values: ['ok', ...Object.keys(HEALTH_API_VALUES)],
    apply: (filter, value) => {
      const health = value.toLowerCase();
      if (!isHealthValue(health)) {
        return false;
      }
      filter.health = health;
      return true;
    },
  },
} satisfies { [Key in SharedFilterKey]: FilterDefinition<SharedRuleFilter, Key> };

/** Exact-match filters refuse `*`, since the rule search would treat it as a wildcard. */
export function hasWildcard(value: string): boolean {
  return value.includes('*');
}

function isHealthValue(value: string): value is HealthValue {
  return value === 'ok' || Object.hasOwn(HEALTH_API_VALUES, value);
}

/** Returns undefined for a value with no label key, such as `=api` or `!`. */
function parseLabelValue(raw: string): SearchLabelMatcher | undefined {
  // A leading `!` not part of `!=`/`!~` means absence.
  if (raw[0] === '!' && raw[1] !== '=' && raw[1] !== '~') {
    const key = raw.slice(1);
    return key.length > 0 ? { key, operator: 'absent' } : undefined;
  }
  if (!/=|!~/.test(raw)) {
    return { key: raw, operator: 'exists' };
  }

  const matcher = attempt(() => parseMatcher(raw));
  if (isError(matcher)) {
    return undefined;
  }
  const { name: key, value, isRegex, isEqual } = matcher;
  // An empty value matches any value, so `team=` is `team`.
  if (value === '' && isEqual && !isRegex) {
    return { key, operator: 'exists' };
  }
  if (isRegex) {
    return { key, operator: isEqual ? 'regex' : 'notRegex', value };
  }
  return { key, operator: isEqual ? 'equal' : 'notEqual', value };
}

function isRejectedLabel({ key, operator, value }: SearchLabelMatcher): boolean {
  if (operator === 'regex' || operator === 'notRegex') {
    // Regex values are patterns, so a literal asterisk is meaningful there. The rule search validates the
    // pattern itself, and a pattern it refuses comes back as a rejection.
    return false;
  }
  const term = operator === 'equal' || operator === 'notEqual' ? `${key}=${value}` : key;
  // A leading "!" or an embedded "!=" would make the matcher's polarity ambiguous next to the operator.
  return hasWildcard(term) || term.startsWith('!') || term.includes('!=');
}

// Mimics the rule search's backend validation, which rejects these UIDs with a 400. Whether the data source
// exists isn't checked: an unknown UID matches no rules, like an unknown folder.
function isQueryDatasourceUid(uid: string): boolean {
  return DATASOURCE_UID_PATTERN.test(uid) && !EXPRESSION_DATASOURCE_UIDS.has(uid);
}

const DATASOURCE_UID_PATTERN = /^[a-zA-Z0-9_-]+$/;
// Expression nodes aren't data sources the backend indexes, so it rejects their UIDs.
const EXPRESSION_DATASOURCE_UIDS = new Set(['__expr__', '-100', '__ml__']);
