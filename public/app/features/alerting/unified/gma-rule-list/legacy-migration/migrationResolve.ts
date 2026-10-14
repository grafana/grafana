import { type Criteria } from '../rule-search/criteria';

import { type SyncMigrationResult } from './migrationSync';

/** Injected lookups so name resolution is testable without HTTP — return undefined for
 * missing or ambiguous names. */
export interface NameResolvers {
  resolveFolderUidByName: (name: string) => Promise<string | undefined>;
  resolveDataSourceUidByName: (name: string) => Promise<string | undefined>;
}

export interface ResolvedMigration {
  criteria: Criteria;
  /** Distinct token keys (namespace/datasource) that had at least one name that couldn't be
   * resolved. The name itself is kept in `criteria.unresolved`, never dropped, and never
   * merged back into `criteria.namespaces`/`dataSourceUids` — see criteria.ts. */
  unresolved: Array<'namespace' | 'datasource'>;
}

async function resolveNames(
  names: string[],
  key: 'namespace' | 'datasource',
  resolve: (name: string) => Promise<string | undefined>
): Promise<{ values: string[]; unresolved: Array<{ key: 'namespace' | 'datasource'; value: string }> }> {
  // Resolve in parallel, but partition by index afterwards so both output arrays keep the
  // original order regardless of which lookup settles first.
  const results = await Promise.all(names.map(async (name) => ({ name, uid: await resolve(name) })));

  const values: string[] = [];
  const unresolved: Array<{ key: 'namespace' | 'datasource'; value: string }> = [];
  for (const { name, uid } of results) {
    if (uid === undefined) {
      unresolved.push({ key, value: name });
    } else {
      values.push(uid);
    }
  }
  return { values, unresolved };
}

/**
 * Async stage of query migration: resolves legacy folder/data-source display names to UIDs.
 * A missing or ambiguous name is kept in `criteria.unresolved` (never dropped, never turned
 * into an unfiltered search) and reported in `unresolved` — see getCriteriaIssues() in
 * criteriaIssues.ts for how the page surfaces that.
 */
export async function resolveMigratedNames(
  sync: SyncMigrationResult,
  resolvers: NameResolvers
): Promise<ResolvedMigration> {
  const namespaces = await resolveNames(sync.criteria.namespaces, 'namespace', resolvers.resolveFolderUidByName);
  const dataSourceUids = await resolveNames(
    sync.criteria.dataSourceUids,
    'datasource',
    resolvers.resolveDataSourceUidByName
  );

  const unresolvedEntries = [...namespaces.unresolved, ...dataSourceUids.unresolved];

  return {
    criteria: {
      ...sync.criteria,
      namespaces: namespaces.values,
      dataSourceUids: dataSourceUids.values,
      unresolved: [...sync.criteria.unresolved, ...unresolvedEntries],
    },
    unresolved: [...new Set(unresolvedEntries.map((entry) => entry.key))],
  };
}
