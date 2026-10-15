import { t } from '@grafana/i18n';

/**
 * One filter, described once. The search input's parser and help and the filter sidebar are all
 * derived from these definitions, and the sidebar lists its fields in the order the page's
 * definitions are listed. Text is produced lazily so it is translated when shown, not when the
 * module loads.
 */
export interface TokenDefinition {
  /** The `key` in `key:value`, e.g. `label`, `namespace`. */
  key: string;
  /** Name of the filter, shared by the help and the sidebar field. */
  label: () => string;
  description: () => string;
  example: string;
  /** Whether the token may repeat (e.g. multiple `label:` or `datasource:` tokens). */
  multiValue?: boolean;
  /** Values of this filter that the search cannot apply yet. */
  unavailableValues?: Array<{ value: string; reason: () => string }>;
}

/** A single token as produced by the tokenizer, with its source span for later caret-based
 * editing (Stage 2 suggestions). `key === null` marks free text. */
export interface RawToken {
  key: string | null;
  value: string;
  quoted: boolean;
  /** False for an unterminated quoted value, e.g. `label:"team` while still typing. */
  closed: boolean;
  start: number;
  end: number;
}

/**
 * New token names chosen for filters that had no equivalent in the legacy search syntax.
 * Listed here (rather than scattered as literals) because they are new user-facing surface
 * area — see the FE-search agent report for the rationale.
 */
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
    label: () => t('alerting.gma-rule-list.search.property.rule-name', 'Rule name'),
    description: () =>
      t('alerting.gma-rule-list.search.help.rule', 'Rule title text search (equivalent to free text).'),
    example: 'rule:cpu-high',
    multiValue: true,
  },
  namespace: {
    key: TOKEN_KEYS.namespace,
    label: () => t('alerting.gma-rule-list.search.property.folder', 'Folder'),
    description: () => t('alerting.gma-rule-list.search.help.namespace', 'Folder (canonical value is the folder UID).'),
    example: 'namespace:folder-uid',
    multiValue: true,
  },
  datasource: {
    key: TOKEN_KEYS.datasource,
    label: () => t('alerting.gma-rule-list.search.property.datasource', 'Query data source'),
    description: () =>
      t(
        'alerting.gma-rule-list.search.help.datasource',
        'Query data source referenced by the rule (canonical value is the UID).'
      ),
    example: 'datasource:ds-uid',
    multiValue: true,
  },
  label: {
    key: TOKEN_KEYS.label,
    label: () => t('alerting.gma-rule-list.search.property.labels', 'Labels'),
    description: () =>
      t(
        'alerting.gma-rule-list.search.help.label',
        'Label matcher: label:key (exists), label:!key (absent), label:key=value (equal), label:key!=value (not equal), label:key=~re (regex), label:key!~re (not regex).'
      ),
    example: 'label:team=api',
    multiValue: true,
  },
  plugins: {
    key: TOKEN_KEYS.plugins,
    label: () => t('alerting.gma-rule-list.search.property.plugins', 'Plugin rules'),
    description: () =>
      t('alerting.gma-rule-list.search.help.plugins', 'plugins:hide excludes rules created by plugins.'),
    example: 'plugins:hide',
  },
  health: {
    key: TOKEN_KEYS.health,
    label: () => t('alerting.gma-rule-list.search.property.health', 'Health'),
    description: () => t('alerting.gma-rule-list.search.help.health', 'Rule health: ok, nodata, error or unknown.'),
    example: 'health:error',
  },
} satisfies Record<string, TokenDefinition>;

export function buildTokenRegistry(definitions: TokenDefinition[]): Map<string, TokenDefinition> {
  return new Map(definitions.map((definition) => [definition.key, definition]));
}
