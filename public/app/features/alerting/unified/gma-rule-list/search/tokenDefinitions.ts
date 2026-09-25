import { type TokenDefinition } from './types';

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

const sharedDefinitions: TokenDefinition[] = [
  {
    key: TOKEN_KEYS.rule,
    description: 'Rule title text search (equivalent to free text).',
    example: 'rule:cpu-high',
    availability: 'available',
    multiValue: true,
  },
  {
    key: TOKEN_KEYS.namespace,
    description: 'Folder (canonical value is the folder UID).',
    example: 'namespace:folder-uid',
    availability: 'available',
    multiValue: true,
  },
  {
    key: TOKEN_KEYS.datasource,
    description: 'Query data source referenced by the rule (canonical value is the UID).',
    example: 'datasource:ds-uid',
    availability: 'available',
    multiValue: true,
  },
  {
    key: TOKEN_KEYS.label,
    description:
      'Label matcher: label:key (exists), label:!key (absent), label:key=value (equal), ' +
      'label:key!=value (not equal), label:key=~re (regex), label:key!~re (not regex).',
    example: 'label:team=api',
    availability: 'available',
    multiValue: true,
  },
  {
    key: TOKEN_KEYS.plugins,
    description: 'plugins:hide excludes rules created by plugins.',
    example: 'plugins:hide',
    availability: 'available',
  },
  {
    key: TOKEN_KEYS.health,
    description: 'Rule health. Visible but filtering is not deployed yet.',
    example: 'health:error',
    availability: 'pending',
  },
];

const alertOnlyDefinitions: TokenDefinition[] = [
  {
    key: TOKEN_KEYS.state,
    description: 'Alert state. Visible but filtering is not deployed yet.',
    example: 'state:firing',
    availability: 'pending',
  },
  {
    key: TOKEN_KEYS.dashboard,
    description: 'Dashboard the rule is linked to (canonical value is the dashboard UID).',
    example: 'dashboard:dash-uid',
    availability: 'available',
  },
  {
    key: TOKEN_KEYS.panelId,
    description: 'Panel the rule is linked to. Panel IDs are dashboard-local; pair with dashboard:.',
    example: 'panelId:4',
    availability: 'available',
  },
  {
    key: TOKEN_KEYS.contactPoint,
    description: 'Direct contact point (mutually exclusive with policy:).',
    example: 'contactPoint:on-call',
    availability: 'available',
  },
  {
    key: TOKEN_KEYS.policy,
    description: 'Named notification policy, or the reserved value "default".',
    example: 'policy:default',
    availability: 'available',
  },
  {
    key: TOKEN_KEYS.paused,
    description: 'Whether the rule is paused (true/false).',
    example: 'paused:true',
    availability: 'available',
  },
];

const recordingOnlyDefinitions: TokenDefinition[] = [
  {
    key: TOKEN_KEYS.metric,
    description: 'Recorded metric name (exact match).',
    example: 'metric:cpu_usage',
    availability: 'available',
  },
  {
    key: TOKEN_KEYS.targetDatasource,
    description: 'Data source the recorded metric is written to (canonical value is the UID).',
    example: 'targetDatasource:ds-uid',
    availability: 'available',
  },
];

export const alertTokens: TokenDefinition[] = [...sharedDefinitions, ...alertOnlyDefinitions];
export const recordingTokens: TokenDefinition[] = [...sharedDefinitions, ...recordingOnlyDefinitions];

export function buildTokenRegistry(definitions: TokenDefinition[]): Map<string, TokenDefinition> {
  return new Map(definitions.map((definition) => [definition.key, definition]));
}
