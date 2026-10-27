import { t } from '@grafana/i18n';

import { type RuleKind } from '../shared/ruleKind';

import { HEALTH_API_VALUES } from './ruleSearchFilter';

/** Text is lazy so it translates when shown. */
export interface FilterDefinition<Kind extends RuleKind = RuleKind> {
  key: FilterKey<Kind>;
  label: () => string;
  description: () => string;
  example: string;
  /** The only values the filter accepts, listed when the typed value isn't one of them. */
  values?: string[];
  unavailableValues?: Array<{ value: string; reason: () => string }>;
}

/** The keys a page of `Kind` supports; without `Kind`, the keys of either page. */
export type FilterKey<Kind extends RuleKind = RuleKind> = FilterKeysByKind[Kind];

type SharedFilterKey = 'rule' | 'folder' | 'datasource' | 'label' | 'plugins' | 'health';

interface FilterKeysByKind {
  alert: SharedFilterKey | 'state' | 'dashboard' | 'panelId' | 'contactPoint' | 'policy' | 'paused';
  recording: SharedFilterKey | 'metric' | 'targetDatasource';
}

export const sharedFilters = {
  rule: {
    key: 'rule',
    label: () => t('alerting.gma-rule-list.search.property.rule-name', 'Rule name'),
    description: () =>
      t('alerting.gma-rule-list.search.help.rule', 'Rule title text search (equivalent to free text).'),
    example: 'rule:cpu-high',
  },
  folder: {
    key: 'folder',
    label: () => t('alerting.gma-rule-list.search.property.folder', 'Folder'),
    description: () => t('alerting.gma-rule-list.search.help.folder', 'Folder (canonical value is the folder UID).'),
    example: 'folder:folder-uid',
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
  },
  plugins: {
    key: 'plugins',
    label: () => t('alerting.gma-rule-list.search.property.plugins', 'Plugin rules'),
    description: () =>
      t('alerting.gma-rule-list.search.help.plugins', 'plugins:hide excludes rules created by plugins.'),
    example: 'plugins:hide',
    values: ['hide'],
  },
  health: {
    key: 'health',
    label: () => t('alerting.gma-rule-list.search.property.health', 'Health'),
    description: () => t('alerting.gma-rule-list.search.help.health', 'Rule health: ok, nodata, error or unknown.'),
    example: 'health:error',
    values: ['ok', ...Object.keys(HEALTH_API_VALUES)],
  },
} satisfies Record<SharedFilterKey, FilterDefinition>;

export function indexByKey(definitions: FilterDefinition[]): Map<string, FilterDefinition> {
  return new Map(definitions.map((definition) => [definition.key, definition]));
}
