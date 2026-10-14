import { createEmptyCriteria } from '../rule-search/criteria';

import { type NameResolvers, resolveMigratedNames } from './migrationResolve';
import { type SyncMigrationResult } from './migrationSync';

function sync(overrides: Partial<SyncMigrationResult['criteria']> = {}): SyncMigrationResult {
  return {
    destination: 'alert',
    mode: 'folders',
    criteria: { ...createEmptyCriteria(), ...overrides },
    diagnostics: { migratedKeys: [], droppedKeys: [], unresolved: [] },
  };
}

function resolvers(overrides: Partial<NameResolvers> = {}): NameResolvers {
  return {
    resolveFolderUidByName: jest.fn(async () => 'folder-uid'),
    resolveDataSourceUidByName: jest.fn(async () => 'ds-uid'),
    ...overrides,
  };
}

describe('resolveMigratedNames', () => {
  it('NAV-4.12: resolves every name and leaves namespaces/dataSourceUids holding only UIDs', async () => {
    const result = await resolveMigratedNames(
      sync({ namespaces: ['My Folder'], dataSourceUids: ['My DS'] }),
      resolvers()
    );

    expect(result.criteria.namespaces).toEqual(['folder-uid']);
    expect(result.criteria.dataSourceUids).toEqual(['ds-uid']);
    expect(result.criteria.unresolved).toEqual([]);
    expect(result.unresolved).toEqual([]);
  });

  it('NAV-4.13: an unresolved name never lands in namespaces/dataSourceUids, only in criteria.unresolved', async () => {
    const result = await resolveMigratedNames(
      sync({ namespaces: ['Missing Folder'] }),
      resolvers({ resolveFolderUidByName: jest.fn(async () => undefined) })
    );

    expect(result.criteria.namespaces).toEqual([]);
    expect(result.criteria.unresolved).toEqual([{ key: 'namespace', value: 'Missing Folder' }]);
    expect(result.unresolved).toEqual(['namespace']);
  });

  it('NAV-4.14: preserves per-entry resolution when only some names resolve', async () => {
    const resolveFolderUidByName = jest.fn(async (name: string) => (name === 'Known' ? 'known-uid' : undefined));
    const result = await resolveMigratedNames(
      sync({ namespaces: ['Known', 'Unknown'] }),
      resolvers({ resolveFolderUidByName })
    );

    expect(result.criteria.namespaces).toEqual(['known-uid']);
    expect(result.criteria.unresolved).toEqual([{ key: 'namespace', value: 'Unknown' }]);
  });
});
