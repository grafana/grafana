import { createEmptyFilter } from '../token-search/ruleSearchFilter';

import { type NameResolvers, resolveMigratedNames } from './migrationResolve';
import { type SyncMigrationResult } from './migrationSync';

function sync(overrides: Partial<SyncMigrationResult['filter']> = {}): SyncMigrationResult {
  return {
    destination: 'alert',
    mode: 'folders',
    filter: { ...createEmptyFilter(), ...overrides },
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
  it('resolves every name and leaves namespaces/dataSourceUids holding only UIDs', async () => {
    const result = await resolveMigratedNames(
      sync({ namespaces: ['My Folder'], dataSourceUids: ['My DS'] }),
      resolvers()
    );

    expect(result.filter.namespaces).toEqual(['folder-uid']);
    expect(result.filter.dataSourceUids).toEqual(['ds-uid']);
    expect(result.droppedKeys).toEqual([]);
  });

  it('a name that resolves to nothing is removed and its key reported, never kept as a token', async () => {
    const result = await resolveMigratedNames(
      sync({ namespaces: ['Missing Folder'] }),
      resolvers({ resolveFolderUidByName: jest.fn(async () => undefined) })
    );

    expect(result.filter.namespaces).toEqual([]);
    expect(result.filter.invalid).toEqual([]);
    expect(result.droppedKeys).toEqual(['namespace']);
  });

  it('keeps the names that resolve when only some do, in their original order', async () => {
    const resolveFolderUidByName = jest.fn(async (name: string) =>
      name === 'Unknown' ? undefined : `${name.toLowerCase()}-uid`
    );
    const result = await resolveMigratedNames(
      sync({ namespaces: ['First', 'Unknown', 'Second'] }),
      resolvers({ resolveFolderUidByName })
    );

    expect(result.filter.namespaces).toEqual(['first-uid', 'second-uid']);
    expect(result.droppedKeys).toEqual(['namespace']);
  });

  it('keeps a key the sync stage dropped in droppedKeys alongside resolver drops', async () => {
    const dropped = sync({ namespaces: ['Missing Folder'] });
    dropped.diagnostics.droppedKeys = ['group'];

    const result = await resolveMigratedNames(
      dropped,
      resolvers({ resolveFolderUidByName: jest.fn(async () => undefined) })
    );

    expect(result.droppedKeys).toEqual(['group', 'namespace']);
  });

  it('a failing lookup is removed like an unresolved name and does not reject', async () => {
    const result = await resolveMigratedNames(
      sync({ namespaces: ['My Folder'], dataSourceUids: ['My DS'] }),
      resolvers({ resolveFolderUidByName: jest.fn().mockRejectedValue(new Error('403')) })
    );

    expect(result.filter.namespaces).toEqual([]);
    expect(result.filter.dataSourceUids).toEqual(['ds-uid']);
    expect(result.droppedKeys).toEqual(['namespace']);
  });
});
