import { reportInteraction } from '@grafana/runtime';

import { logWarning } from '../../Analytics';
import { type RuleKind } from '../shared/ruleKind';
import { serialize } from '../token-search/serializer';
import { TOKEN_KEYS } from '../token-search/tokens';

import { type NameResolvers, resolveMigratedNames } from './migrationResolve';
import { type LegacyRuleListParams, type MigrationDiagnostics, migrateLegacyRuleListUrlSync } from './migrationSync';

// Event payloads carry only these names; user-typed tokens are reported as `other`.
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

const DESTINATION_PATH: Record<RuleKind, string> = {
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

/** Single pipeline for redirects, direct URLs and applied saved searches so they cannot drift. */
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
  const search = serialize(resolved.filter);
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

/** Called from the orchestrator, not render, so it fires once. Never include values, UIDs or resource names. */
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
