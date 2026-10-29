import { type RuleSearchFilter } from '../token-search/ruleSearchFilter';

import { type SyncMigrationResult } from './migrationSync';

/** Lookups return undefined for missing or ambiguous names; a rejection counts as unresolved. */
export interface NameResolvers {
  resolveFolderUidByName: (name: string) => Promise<string | undefined>;
  resolveDataSourceUidByName: (name: string) => Promise<string | undefined>;
}

export interface ResolvedMigration {
  /** Only the UIDs that resolved. */
  filter: RuleSearchFilter;
  /** Sorted, distinct keys dropped by either stage, including names that matched no single folder or data source. */
  droppedKeys: string[];
}

async function resolveNames(
  names: string[],
  resolve: (name: string) => Promise<string | undefined>
): Promise<{ uids: string[]; hasUnresolved: boolean }> {
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        return await resolve(name);
      } catch {
        // A failed lookup is dropped like an unmatched name instead of failing the redirect.
        return undefined;
      }
    })
  );

  const uids = results.filter((uid): uid is string => uid !== undefined);
  return { uids, hasUnresolved: uids.length < names.length };
}

/** Unresolved names are dropped and reported, never searched unfiltered. */
export async function resolveMigratedNames(
  sync: SyncMigrationResult,
  resolvers: NameResolvers
): Promise<ResolvedMigration> {
  const [namespaces, dataSourceUids] = await Promise.all([
    resolveNames(sync.filter.namespaces, resolvers.resolveFolderUidByName),
    resolveNames(sync.filter.dataSourceUids, resolvers.resolveDataSourceUidByName),
  ]);

  const droppedKeys = new Set(sync.diagnostics.droppedKeys);
  if (namespaces.hasUnresolved) {
    droppedKeys.add('namespace');
  }
  if (dataSourceUids.hasUnresolved) {
    droppedKeys.add('datasource');
  }

  return {
    filter: { ...sync.filter, namespaces: namespaces.uids, dataSourceUids: dataSourceUids.uids },
    droppedKeys: [...droppedKeys].sort(),
  };
}
