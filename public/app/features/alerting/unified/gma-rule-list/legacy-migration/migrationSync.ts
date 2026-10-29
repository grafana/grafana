import { type RuleKind } from '../shared/ruleKind';
import { alertTokens } from '../token-search/alertTokens';
import { parse } from '../token-search/parser';
import { recordingTokens } from '../token-search/recordingTokens';
import { type RuleSearchFilter } from '../token-search/ruleSearchFilter';
import { quoteIfNeeded } from '../token-search/serializer';
import { tokenize } from '../token-search/tokenizer';

export type ViewMode = 'list' | 'folders';

export interface LegacyRuleListParams {
  search?: string | null;
  view?: string | null;
  dataSource?: string | null;
  alertState?: string | null;
  ruleType?: string | null;
  queryString?: string | null;
}

export interface MigrationDiagnostics {
  migratedKeys: string[];
  /** Sorted token names removed as inapplicable, unknown or malformed. Names only, never values. */
  droppedKeys: string[];
}

export interface SyncMigrationResult {
  destination: RuleKind;
  mode: ViewMode;
  /** May still hold legacy display names instead of UIDs; resolved by the async stage. */
  filter: RuleSearchFilter;
  diagnostics: MigrationDiagnostics;
}

interface WorkingToken {
  key: string | null;
  value: string;
}

function destinationRegistry(destination: RuleKind) {
  return destination === 'recording' ? recordingTokens : alertTokens;
}

/** Pure sync stage; name-to-UID resolution is a separate async stage because it needs authorized lookups. */
export function migrateLegacyRuleListUrlSync(params: LegacyRuleListParams): SyncMigrationResult {
  const migratedKeys = new Set<string>();
  const droppedKeys = new Set<string>();

  // An unterminated quote swallows the rest of the query, so the token is removed as malformed.
  let working: WorkingToken[] = [];
  for (const token of tokenize(params.search ?? '')) {
    if (token.key !== null && token.quoted && !token.closed) {
      droppedKeys.add(token.key);
    } else {
      working.push({ key: token.key, value: token.value });
    }
  }

  // 1. `type:` beats legacy `ruleType`, which beats the Alert default; it only picks a page, so it is never reported.
  const typeToken = working.find((t) => t.key === 'type');
  const typeValue = typeToken?.value ?? params.ruleType ?? undefined;
  const destination: RuleKind = typeValue === 'recording' ? 'recording' : 'alert';
  working = working.filter((t) => t.key !== 'type');

  if (!working.some((t) => t.key === 'datasource') && params.dataSource) {
    working.push({ key: 'datasource', value: params.dataSource });
    migratedKeys.add('dataSource');
  }
  if (!working.some((t) => t.key === 'state') && params.alertState) {
    working.push({ key: 'state', value: params.alertState });
    migratedKeys.add('alertState');
  }
  if (!working.some((t) => t.key === null && t.value.length > 0) && params.queryString) {
    working.push({ key: null, value: params.queryString });
    migratedKeys.add('queryString');
  }

  // 3. `group:` never applies; evaluation groups do not exist.
  if (working.some((t) => t.key === 'group')) {
    droppedKeys.add('group');
    working = working.filter((t) => t.key !== 'group');
  }

  // 4. `source:grafana` is redundant and removed silently; `source:datasource` is removed with a warning.
  const sourceToken = working.find((t) => t.key === 'source');
  if (sourceToken) {
    if (sourceToken.value === 'datasource') {
      droppedKeys.add('source');
    }
    working = working.filter((t) => t.key !== 'source');
  }

  const reserialized = working
    .map((t) => (t.key ? `${t.key}:${quoteIfNeeded(t.value)}` : quoteIfNeeded(t.value)))
    .join(' ');
  const filter = parse(reserialized, destinationRegistry(destination));

  // 5. Remove what the destination cannot apply: other page's filters, unknown, malformed or repeated tokens.
  for (const token of filter.invalid) {
    droppedKeys.add(token.key);
  }
  filter.invalid = [];

  // 6. `view=list` stays; grouped, legacy `state` or missing become Folders (no evaluation groups).
  const mode: ViewMode = params.view === 'list' ? 'list' : 'folders';

  return {
    destination,
    mode,
    filter,
    diagnostics: {
      migratedKeys: [...migratedKeys].sort(),
      droppedKeys: [...droppedKeys].sort(),
    },
  };
}
