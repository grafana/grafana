import { type Criteria } from './criteria';

/** Whether a token's backing API filter capability has landed yet. Unavailable tokens still
 * round-trip through the parser/serializer but are never turned into a search predicate. */
export type TokenAvailability = 'available' | 'pending';

export interface TokenDefinition {
  /** The `key` in `key:value`, e.g. `label`, `namespace`. */
  key: string;
  description: string;
  example: string;
  availability: TokenAvailability;
  /** Whether the token may repeat (e.g. multiple `label:` or `datasource:` tokens). */
  multiValue?: boolean;
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

export interface ParsedToken extends RawToken {
  /** Whether `key` is declared in the registry passed to parse(). */
  known: boolean;
  /** Empty value (`label:`) or an unterminated quote — still being typed, not yet a filter. */
  incomplete: boolean;
}

export interface ParseResult {
  tokens: ParsedToken[];
  criteria: Criteria;
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

export const sharedDefinitions: TokenDefinition[] = [
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

export function buildTokenRegistry(definitions: TokenDefinition[]): Map<string, TokenDefinition> {
  return new Map(definitions.map((definition) => [definition.key, definition]));
}
