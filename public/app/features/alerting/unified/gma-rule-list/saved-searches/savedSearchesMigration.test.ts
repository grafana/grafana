import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { type NameResolvers } from '../legacy-migration/migrationResolve';
import { alertTokens } from '../rule-search/alertTokens';
import { type Criteria } from '../rule-search/criteria';
import { parse } from '../rule-search/parser';

// In-memory store keyed by storage key, shared across the mocked UserStorage instances that
// createStorageLoader/UserStorage construct internally — mirrors the module-level cache the
// real implementation replaces, without touching real browser storage.
let store: Record<string, string | undefined> = {};

const mockUserStorage = {
  getItem: jest.fn(async (key: string) => store[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    store[key] = value;
  }),
};

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  UserStorage: jest.fn().mockImplementation(() => mockUserStorage),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    namespace: 'default',
    bootData: {
      ...jest.requireActual('@grafana/runtime').config.bootData,
      navTree: [],
      user: { uid: 'test-user-123', id: 123, isSignedIn: true },
    },
  },
}));

import {
  ALERT_SAVED_SEARCHES_STORAGE_KEY,
  RECORDING_SAVED_SEARCHES_STORAGE_KEY,
  applySavedSearch,
  copyLegacySavedSearchesOnce,
  migratedMarkerKeyForKind,
} from './savedSearchesMigration';

function parseAlertQuery(query: string): Criteria {
  return parse(query, alertTokens);
}

function resolvers(overrides: Partial<NameResolvers> = {}): NameResolvers {
  return {
    resolveFolderUidByName: jest.fn(async (name: string) => `${name}-uid`),
    resolveDataSourceUidByName: jest.fn(async (name: string) => `${name}-uid`),
    ...overrides,
  };
}

function legacySearch(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return { id: 'legacy-1', name: 'My search', query: 'cpu', isDefault: false, createdAt: 1, ...overrides };
}

async function readCollection(key: string): Promise<SavedSearch[]> {
  const raw = store[key];
  return raw ? JSON.parse(raw) : [];
}

function wasKeyWritten(key: string): boolean {
  return mockUserStorage.setItem.mock.calls.some(([writtenKey]) => writtenKey === key);
}

describe('copyLegacySavedSearchesOnce', () => {
  beforeEach(() => {
    store = {};
    jest.clearAllMocks();
  });

  it('SAVE-2: creates no collection entries when the legacy collection is empty, but still marks both kinds migrated', async () => {
    await copyLegacySavedSearchesOnce(resolvers());

    expect(await readCollection(ALERT_SAVED_SEARCHES_STORAGE_KEY)).toEqual([]);
    expect(await readCollection(RECORDING_SAVED_SEARCHES_STORAGE_KEY)).toEqual([]);
    expect(await mockUserStorage.getItem(migratedMarkerKeyForKind('alert'))).toBe('true');
    expect(await mockUserStorage.getItem(migratedMarkerKeyForKind('recording'))).toBe('true');
  });

  it('SAVE-2: copies an untyped legacy entry into the Alert collection', async () => {
    store.savedSearches = JSON.stringify([legacySearch({ query: 'cpu' })]);

    await copyLegacySavedSearchesOnce(resolvers());

    const alertSearches = await readCollection(ALERT_SAVED_SEARCHES_STORAGE_KEY);
    expect(alertSearches).toEqual([
      { id: 'legacy-1', name: 'My search', query: 'cpu', isDefault: false, createdAt: 1 },
    ]);
    expect(await readCollection(RECORDING_SAVED_SEARCHES_STORAGE_KEY)).toEqual([]);
  });

  it('SAVE-2: routes type:recording to the Recording collection and strips the type: token', async () => {
    store.savedSearches = JSON.stringify([legacySearch({ query: 'type:recording cpu' })]);

    await copyLegacySavedSearchesOnce(resolvers());

    const recordingSearches = await readCollection(RECORDING_SAVED_SEARCHES_STORAGE_KEY);
    expect(recordingSearches).toEqual([
      { id: 'legacy-1', name: 'My search', query: 'cpu', isDefault: false, createdAt: 1 },
    ]);
  });

  it('SAVE-2: resolves legacy folder names to UIDs in the copied query', async () => {
    store.savedSearches = JSON.stringify([legacySearch({ query: 'namespace:My-Folder' })]);

    await copyLegacySavedSearchesOnce(resolvers({ resolveFolderUidByName: jest.fn(async () => 'folder-uid-1') }));

    const [copied] = await readCollection(ALERT_SAVED_SEARCHES_STORAGE_KEY);
    expect(copied.query).toBe('namespace:folder-uid-1');
  });

  it('SAVE-2: is idempotent — a retry does not duplicate or overwrite an edited entry', async () => {
    store.savedSearches = JSON.stringify([legacySearch({ query: 'cpu' })]);
    store[ALERT_SAVED_SEARCHES_STORAGE_KEY] = JSON.stringify([
      { id: 'legacy-1', name: 'Renamed by user', query: 'cpu', isDefault: false, createdAt: 1 },
    ]);

    await copyLegacySavedSearchesOnce(resolvers());

    expect(wasKeyWritten(ALERT_SAVED_SEARCHES_STORAGE_KEY)).toBe(false);
    expect(await readCollection(ALERT_SAVED_SEARCHES_STORAGE_KEY)).toEqual([
      { id: 'legacy-1', name: 'Renamed by user', query: 'cpu', isDefault: false, createdAt: 1 },
    ]);
  });

  it("MIGRATE-1: a copied entry the user deletes stays deleted after a later run (marker gates the collection, not just the entry's id)", async () => {
    store.savedSearches = JSON.stringify([legacySearch({ query: 'cpu' })]);
    await copyLegacySavedSearchesOnce(resolvers());
    expect(await readCollection(ALERT_SAVED_SEARCHES_STORAGE_KEY)).toHaveLength(1);

    // User deletes the copied entry from the new collection.
    store[ALERT_SAVED_SEARCHES_STORAGE_KEY] = JSON.stringify([]);
    mockUserStorage.setItem.mockClear();

    await copyLegacySavedSearchesOnce(resolvers());

    expect(await readCollection(ALERT_SAVED_SEARCHES_STORAGE_KEY)).toEqual([]);
    expect(wasKeyWritten(ALERT_SAVED_SEARCHES_STORAGE_KEY)).toBe(false);
  });

  it('MIGRATE-2: a default the user changes in the new collection survives a later run', async () => {
    store.savedSearches = JSON.stringify([legacySearch({ isDefault: true })]);
    await copyLegacySavedSearchesOnce(resolvers());
    const [copied] = await readCollection(ALERT_SAVED_SEARCHES_STORAGE_KEY);
    expect(copied.isDefault).toBe(true);

    // User unsets the default in the new collection.
    store[ALERT_SAVED_SEARCHES_STORAGE_KEY] = JSON.stringify([{ ...copied, isDefault: false }]);
    mockUserStorage.setItem.mockClear();

    await copyLegacySavedSearchesOnce(resolvers());

    const [afterRerun] = await readCollection(ALERT_SAVED_SEARCHES_STORAGE_KEY);
    expect(afterRerun.isDefault).toBe(false);
    expect(wasKeyWritten(ALERT_SAVED_SEARCHES_STORAGE_KEY)).toBe(false);
  });

  it('MIGRATE-3: a write failure leaves no marker, so a later run retries without duplicating', async () => {
    store.savedSearches = JSON.stringify([legacySearch({ query: 'cpu' })]);
    mockUserStorage.setItem.mockImplementationOnce(async () => {
      throw new Error('storage unavailable');
    });

    await copyLegacySavedSearchesOnce(resolvers());

    expect(await readCollection(ALERT_SAVED_SEARCHES_STORAGE_KEY)).toEqual([]);
    expect(await mockUserStorage.getItem(migratedMarkerKeyForKind('alert'))).not.toBe('true');

    await copyLegacySavedSearchesOnce(resolvers());

    expect(await readCollection(ALERT_SAVED_SEARCHES_STORAGE_KEY)).toEqual([
      { id: 'legacy-1', name: 'My search', query: 'cpu', isDefault: false, createdAt: 1 },
    ]);
    expect(await mockUserStorage.getItem(migratedMarkerKeyForKind('alert'))).toBe('true');
  });

  it('SAVE-2: preserves the default flag when the destination collection has no default yet', async () => {
    store.savedSearches = JSON.stringify([legacySearch({ isDefault: true })]);

    await copyLegacySavedSearchesOnce(resolvers());

    const [copied] = await readCollection(ALERT_SAVED_SEARCHES_STORAGE_KEY);
    expect(copied.isDefault).toBe(true);
  });

  it('SAVE-2: does not create a second default when the destination already has one', async () => {
    store.savedSearches = JSON.stringify([legacySearch({ isDefault: true })]);
    store[ALERT_SAVED_SEARCHES_STORAGE_KEY] = JSON.stringify([
      { id: 'existing', name: 'Existing default', query: 'foo', isDefault: true, createdAt: 0 },
    ]);

    await copyLegacySavedSearchesOnce(resolvers());

    const alertSearches = await readCollection(ALERT_SAVED_SEARCHES_STORAGE_KEY);
    const copied = alertSearches.find((s) => s.id === 'legacy-1');
    expect(copied?.isDefault).toBe(false);
  });

  it('SAVE-2: leaves the legacy collection untouched', async () => {
    store.savedSearches = JSON.stringify([legacySearch({ query: 'cpu' })]);

    await copyLegacySavedSearchesOnce(resolvers());

    expect(await readCollection('savedSearches')).toEqual([legacySearch({ query: 'cpu' })]);
  });
});

describe('applySavedSearch', () => {
  beforeEach(() => {
    store = {};
    jest.clearAllMocks();
  });

  it('SAVE-2: returns criteria straight from an already-canonical query, without migrating', async () => {
    const parseForKind = jest.fn(parseAlertQuery);
    const persist = jest.fn();

    const result = await applySavedSearch('cpu', resolvers(), parseForKind, persist);

    expect(result.query).toBe('cpu');
    expect(persist).not.toHaveBeenCalled();
    expect(parseForKind).toHaveBeenCalledWith('cpu');
  });

  it('SAVE-2: migrates a still-legacy query and persists the canonical form before returning', async () => {
    const parseForKind = jest.fn(parseAlertQuery);
    const persist = jest.fn(async () => {});

    const result = await applySavedSearch('type:alerting cpu', resolvers(), parseForKind, persist);

    expect(result.query).toBe('cpu');
    expect(persist).toHaveBeenCalledWith('cpu');
  });

  it('SAVE-2: still returns criteria to search with even when persisting the migrated query fails', async () => {
    const parseForKind = jest.fn(parseAlertQuery);
    const persist = jest.fn(async () => {
      throw new Error('storage unavailable');
    });

    const result = await applySavedSearch('type:alerting cpu', resolvers(), parseForKind, persist);

    expect(result.query).toBe('cpu');
    expect(result.criteria.text).toEqual(['cpu']);
  });

  it('SAVE-2: names the filters the conversion removed, without their values', async () => {
    const result = await applySavedSearch(
      'type:alerting namespace:Gone group:g1 cpu',
      resolvers({ resolveFolderUidByName: jest.fn(async () => undefined) }),
      parseAlertQuery,
      jest.fn(async () => {})
    );

    expect(result.query).toBe('cpu');
    expect(result.droppedKeys).toEqual(['group', 'namespace']);
  });
});
