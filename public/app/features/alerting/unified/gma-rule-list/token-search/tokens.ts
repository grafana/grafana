import { t } from '@grafana/i18n';

/** One filter, described once: parser, help and sidebar derive from it. Text is lazy so it translates when shown. */
export interface TokenDefinition {
  key: string;
  label: () => string;
  description: () => string;
  example: string;
  multiValue?: boolean;
  unavailableValues?: Array<{ value: string; reason: () => string }>;
}

/** `key === null` marks free text. The span is for later caret-based editing. */
export interface RawToken {
  key: string | null;
  value: string;
  quoted: boolean;
  /** False for an unterminated quoted value. */
  closed: boolean;
  start: number;
  end: number;
}

export const TOKEN_KEYS = {
  rule: 'rule',
  namespace: 'namespace',
  datasource: 'datasource',
  label: 'label',
  plugins: 'plugins',
  health: 'health',
  state: 'state',
  dashboard: 'dashboard',
  panelId: 'panelId',
  contactPoint: 'contactPoint',
  policy: 'policy',
  paused: 'paused',
  metric: 'metric',
  targetDatasource: 'targetDatasource',
} as const;

export const sharedDefinitions = {
  rule: {
    key: TOKEN_KEYS.rule,
    label: () => t('alerting.gma-rule-list.token-search.property.rule-name', 'Rule name'),
    description: () =>
      t('alerting.gma-rule-list.token-search.help.rule', 'Rule title text search (equivalent to free text).'),
    example: 'rule:cpu-high',
    multiValue: true,
  },
  namespace: {
    key: TOKEN_KEYS.namespace,
    label: () => t('alerting.gma-rule-list.token-search.property.folder', 'Folder'),
    description: () => t('alerting.gma-rule-list.token-search.help.namespace', 'Folder (canonical value is the folder UID).'),
    example: 'namespace:folder-uid',
    multiValue: true,
  },
  datasource: {
    key: TOKEN_KEYS.datasource,
    label: () => t('alerting.gma-rule-list.token-search.property.datasource', 'Query data source'),
    description: () =>
      t(
        'alerting.gma-rule-list.token-search.help.datasource',
        'Query data source referenced by the rule (canonical value is the UID).'
      ),
    example: 'datasource:ds-uid',
    multiValue: true,
  },
  label: {
    key: TOKEN_KEYS.label,
    label: () => t('alerting.gma-rule-list.token-search.property.labels', 'Labels'),
    description: () =>
      t(
        'alerting.gma-rule-list.token-search.help.label',
        'Label matcher: label:key (exists), label:!key (absent), label:key=value (equal), label:key!=value (not equal), label:key=~re (regex), label:key!~re (not regex).'
      ),
    example: 'label:team=api',
    multiValue: true,
  },
  plugins: {
    key: TOKEN_KEYS.plugins,
    label: () => t('alerting.gma-rule-list.token-search.property.plugins', 'Plugin rules'),
    description: () =>
      t('alerting.gma-rule-list.token-search.help.plugins', 'plugins:hide excludes rules created by plugins.'),
    example: 'plugins:hide',
  },
  health: {
    key: TOKEN_KEYS.health,
    label: () => t('alerting.gma-rule-list.token-search.property.health', 'Health'),
    description: () => t('alerting.gma-rule-list.token-search.help.health', 'Rule health: ok, nodata, error or unknown.'),
    example: 'health:error',
  },
} satisfies Record<string, TokenDefinition>;

export function buildTokenRegistry(definitions: TokenDefinition[]): Map<string, TokenDefinition> {
  return new Map(definitions.map((definition) => [definition.key, definition]));
}
