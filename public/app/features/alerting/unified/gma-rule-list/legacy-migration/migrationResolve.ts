import { type Criteria } from '../rule-search/criteria';

import { type SyncMigrationResult } from './migrationSync';

/** Injected lookups so name resolution is testable without HTTP — return undefined for
 * missing or ambiguous names. A lookup that rejects counts as unresolved. */
export interface NameResolvers {
  resolveFolderUidByName: (name: string) => Promise<string | undefined>;
  resolveDataSourceUidByName: (name: string) => Promise<string | undefined>;
}

export interface ResolvedMigration {
  /** `namespaces` and `dataSourceUids` hold only the UIDs that resolved. */
  criteria: Criteria;
  /** Sorted, distinct keys dropped by either stage: the sync stage's dropped keys plus
   * namespace/datasource when a name matched no single folder or data source, or its lookup failed. */
  droppedKeys: string[];
}

async function resolveNames(
  names: string[],
  resolve: (name: string) => Promise<string | undefined>
): Promise<{ uids: string[]; hasUnresolved: boolean }> {
  // Resolve in parallel; Promise.all keeps the results in the original order whichever lookup
  // settles first.
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        return await resolve(name);
      } catch {
        // A failed lookup must not fail the whole redirect; the name is removed like one that matched nothing.
        return undefined;
      }
    })
  );

  const uids = results.filter((uid): uid is string => uid !== undefined);
  return { uids, hasUnresolved: uids.length < names.length };
}

/**
 * Async stage of query migration: resolves legacy folder/data-source display names to UIDs. A
 * name that matches no single folder or data source, or whose lookup fails, is removed — never
 * kept as a token and never turned into an unfiltered search — and its key is reported in
 * `droppedKeys` so the destination page can warn about it.
 */
export async function resolveMigratedNames(
  sync: SyncMigrationResult,
  resolvers: NameResolvers
): Promise<ResolvedMigration> {
  const [namespaces, dataSourceUids] = await Promise.all([
    resolveNames(sync.criteria.namespaces, resolvers.resolveFolderUidByName),
    resolveNames(sync.criteria.dataSourceUids, resolvers.resolveDataSourceUidByName),
  ]);

  const droppedKeys = new Set(sync.diagnostics.droppedKeys);
  if (namespaces.hasUnresolved) {
    droppedKeys.add('namespace');
  }
  if (dataSourceUids.hasUnresolved) {
    droppedKeys.add('datasource');
  }

  return {
    criteria: { ...sync.criteria, namespaces: namespaces.uids, dataSourceUids: dataSourceUids.uids },
    droppedKeys: [...droppedKeys].sort(),
  };
}
