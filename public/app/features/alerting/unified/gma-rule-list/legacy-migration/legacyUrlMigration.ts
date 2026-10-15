import { reportInteraction } from '@grafana/runtime';

import { logWarning } from '../../Analytics';
import { serialize } from '../rule-search/serializer';
import { TOKEN_KEYS } from '../rule-search/tokens';

import { type NameResolvers, resolveMigratedNames } from './migrationResolve';
import {
  type Destination,
  type LegacyRuleListParams,
  type MigrationDiagnostics,
  migrateLegacyRuleListUrlSync,
} from './migrationSync';

// Event payloads carry names from this fixed list only; a user-typed token name is reported as `other`.
const ANALYTICS_FILTER_KEYS = new Set<string>([
  ...Object.values(TOKEN_KEYS),
  'type',
  'group',
  'source',
  'dataSource',
  'alertState',
  'ruleType',
  'queryString',
]);

const DESTINATION_PATH: Record<Destination, string> = {
  alert: '/alerting/rules/alert',
  recording: '/alerting/rules/recording',
};

export interface MigrationResult {
  pathname: string;
  search: string;
  diagnostics: MigrationDiagnostics;
}

function toAnalyticsKey(key: string): string {
  return ANALYTICS_FILTER_KEYS.has(key) ? key : 'other';
}

/** Reads the legacy combined-list URL parameters this migration understands out of a
 * `location.search`-style string. */
export function parseLegacyRuleListParams(search: string): LegacyRuleListParams {
  const params = new URLSearchParams(search);
  return {
    search: params.get('search'),
    view: params.get('view'),
    dataSource: params.get('dataSource'),
    alertState: params.get('alertState'),
    ruleType: params.get('ruleType'),
    queryString: params.get('queryString'),
  };
}

/**
 * One asynchronous migration pipeline for old-route redirects, directly opened URLs, and
 * applied saved searches, so all three go through the same translation instead of drifting.
 * Runs the pure sync stage, then resolves any legacy folder/data-source names, then emits
 * diagnostics.
 */
export async function migrateLegacyRuleListUrl(
  location: { search: string },
  resolvers: NameResolvers
): Promise<MigrationResult> {
  const params = parseLegacyRuleListParams(location.search);
  const sync = migrateLegacyRuleListUrlSync(params);
  const resolved = await resolveMigratedNames(sync, resolvers);

  const diagnostics: MigrationDiagnostics = {
    migratedKeys: sync.diagnostics.migratedKeys,
    droppedKeys: resolved.droppedKeys,
  };

  reportMigrationDiagnostics(diagnostics);
  for (const key of diagnostics.droppedKeys) {
    logWarning('Removed a rule-list filter incompatible with its migration destination', {
      filterKey: toAnalyticsKey(key),
    });
  }

  const urlParams = new URLSearchParams();
  const search = serialize(resolved.criteria);
  if (search.length > 0) {
    urlParams.set('search', search);
  }
  if (sync.mode === 'list') {
    urlParams.set('view', 'list');
  }

  const query = urlParams.toString();
  return {
    pathname: DESTINATION_PATH[sync.destination],
    search: query.length > 0 ? `?${query}` : '',
    diagnostics,
  };
}

/**
 * Emits `grafana_alerting_gma_list_query_migration` once per migration, called from the
 * orchestrator rather than render logic so it can't fire repeatedly on every re-render.
 * Never include filter values, queries, UIDs, or resource names — only sorted, allowlisted
 * token names.
 */
function reportMigrationDiagnostics(diagnostics: MigrationDiagnostics): void {
  if (diagnostics.migratedKeys.length === 0 && diagnostics.droppedKeys.length === 0) {
    return;
  }

  const payload: Record<string, string> = {
    migrated_filter_keys: diagnostics.migratedKeys.join(','),
  };
  if (diagnostics.droppedKeys.length > 0) {
    payload.dropped_filter_keys = [...new Set(diagnostics.droppedKeys.map(toAnalyticsKey))].sort().join(',');
  }

  reportInteraction('grafana_alerting_gma_list_query_migration', payload);
}
