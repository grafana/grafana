import { alertTokens } from '../rule-search/alertTokens';
import { type Criteria } from '../rule-search/criteria';
import { parse } from '../rule-search/parser';
import { recordingTokens } from '../rule-search/recordingTokens';
import { quoteIfNeeded } from '../rule-search/serializer';
import { tokenize } from '../rule-search/tokenizer';

export type Destination = 'alert' | 'recording';
export type ViewMode = 'list' | 'folders';

/** The legacy combined-list URL parameters this migration understands, read from
 * `location.search` by the caller (legacyUrlMigration.ts). */
export interface LegacyRuleListParams {
  search?: string | null;
  view?: string | null;
  dataSource?: string | null;
  alertState?: string | null;
  ruleType?: string | null;
  queryString?: string | null;
}

export interface MigrationDiagnostics {
  /** Sorted, allowlisted legacy param/token names that were translated into their canonical
   * equivalent. */
  migratedKeys: string[];
  /** Sorted token names removed because the destination page cannot apply them: they do not
   * apply to it, no longer exist, are unknown, or are malformed. Names only, never values. */
  droppedKeys: string[];
}

export interface SyncMigrationResult {
  destination: Destination;
  mode: ViewMode;
  /** Criteria with namespace/data-source entries still possibly holding legacy display
   * names rather than UIDs — resolved by the async stage (migrationResolve.ts). Never holds an
   * invalid token: those are dropped here. */
  criteria: Criteria;
  diagnostics: MigrationDiagnostics;
}

interface WorkingToken {
  key: string | null;
  value: string;
}

function destinationRegistry(destination: Destination) {
  return destination === 'recording' ? recordingTokens : alertTokens;
}

/**
 * Pure synchronous stage of query migration: parses the legacy `search` string, normalizes
 * the separate legacy params, resolves `type:`/`ruleType` routing, and drops tokens that
 * don't apply to the chosen destination. Name-to-UID resolution (namespace/datasource) is
 * a separate async stage (migrationResolve.ts) since it needs authorized lookups.
 */
export function migrateLegacyRuleListUrlSync(params: LegacyRuleListParams): SyncMigrationResult {
  const migratedKeys = new Set<string>();
  const droppedKeys = new Set<string>();

  // An unterminated quote swallows the rest of the query into one value, so a keyed token that
  // has one is malformed: it is removed rather than reinterpreted as a different filter.
  let working: WorkingToken[] = [];
  for (const token of tokenize(params.search ?? '')) {
    if (token.key !== null && token.quoted && !token.closed) {
      droppedKeys.add(token.key);
    } else {
      working.push({ key: token.key, value: token.value });
    }
  }

  // 1. Destination: an explicit `type:` token wins over the legacy `ruleType` param, which
  // wins over defaulting to Alert. `type:` only ever selects a page — it's not a filter, so
  // it never appears in the diagnostics.
  const typeToken = working.find((t) => t.key === 'type');
  const typeValue = typeToken?.value ?? params.ruleType ?? undefined;
  const destination: Destination = typeValue === 'recording' ? 'recording' : 'alert';
  working = working.filter((t) => t.key !== 'type');

  // 2. Normalize legacy params whose canonical equivalent isn't already present.
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

  // 3. `group:` never applies to the migrated UI — evaluation groups don't exist.
  if (working.some((t) => t.key === 'group')) {
    droppedKeys.add('group');
    working = working.filter((t) => t.key !== 'group');
  }

  // 4. `source:grafana` is redundant (everything here is Grafana-managed) and is removed
  // silently; `source:datasource` is unsupported and is removed with a warning.
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
  const { criteria } = parse(reserialized, destinationRegistry(destination));

  // 5. Whatever the destination cannot apply is removed rather than carried into the new URL:
  // a filter that belongs to the other page (dashboard: on Recording), an unknown token, or a
  // malformed or repeated one.
  for (const token of criteria.invalid) {
    droppedKeys.add(token.key);
  }
  criteria.invalid = [];

  // 6. View mode: keep `view=list`; `view=grouped`, the unsupported legacy `view=state`, and
  // no `view` at all all become Folders (evaluation groups don't exist in the migrated UI,
  // so there's nothing left for the legacy "grouped" distinction to mean besides Folders).
  const mode: ViewMode = params.view === 'list' ? 'list' : 'folders';

  return {
    destination,
    mode,
    criteria,
    diagnostics: {
      migratedKeys: [...migratedKeys].sort(),
      droppedKeys: [...droppedKeys].sort(),
    },
  };
}
