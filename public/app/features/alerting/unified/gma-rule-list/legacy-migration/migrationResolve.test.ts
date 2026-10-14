import { createEmptyCriteria } from '../rule-search/criteria';

import { type NameResolvers, resolveMigratedNames } from './migrationResolve';
import { type SyncMigrationResult } from './migrationSync';

function sync(overrides: Partial<SyncMigrationResult['criteria']> = {}): SyncMigrationResult {
  return {
    destination: 'alert',
    mode: 'folders',
    criteria: { ...createEmptyCriteria(), ...overrides },
    diagnostics: { migratedKeys: [], droppedKeys: [] },
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
    expect(result.droppedKeys).toEqual([]);
  });

  it('NAV-4.13: a name that resolves to nothing is removed and its key reported, never kept as a token', async () => {
    const result = await resolveMigratedNames(
      sync({ namespaces: ['Missing Folder'] }),
      resolvers({ resolveFolderUidByName: jest.fn(async () => undefined) })
    );

    expect(result.criteria.namespaces).toEqual([]);
    expect(result.criteria.invalid).toEqual([]);
    expect(result.droppedKeys).toEqual(['namespace']);
  });

  it('NAV-4.14: keeps the names that resolve when only some do, in their original order', async () => {
    const resolveFolderUidByName = jest.fn(async (name: string) =>
      name === 'Unknown' ? undefined : `${name.toLowerCase()}-uid`
    );
    const result = await resolveMigratedNames(
      sync({ namespaces: ['First', 'Unknown', 'Second'] }),
      resolvers({ resolveFolderUidByName })
    );

    expect(result.criteria.namespaces).toEqual(['first-uid', 'second-uid']);
    expect(result.droppedKeys).toEqual(['namespace']);
  });

  it('NAV-4.17: a failing lookup is removed like an unresolved name and does not reject', async () => {
    const result = await resolveMigratedNames(
      sync({ namespaces: ['My Folder'], dataSourceUids: ['My DS'] }),
      resolvers({ resolveFolderUidByName: jest.fn().mockRejectedValue(new Error('403')) })
    );

    expect(result.criteria.namespaces).toEqual([]);
    expect(result.criteria.dataSourceUids).toEqual(['ds-uid']);
    expect(result.droppedKeys).toEqual(['namespace']);
  });
});
