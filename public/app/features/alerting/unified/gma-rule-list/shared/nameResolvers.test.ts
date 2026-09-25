import { configureStore } from '@reduxjs/toolkit';
import { HttpResponse, http } from 'msw';
import { type Store } from 'redux';

import { generatedAPI as folderSearchAPI } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { setStore } from 'app/store/store';
import { type StoreState } from 'app/types/store';

import { setupMswServer } from '../../mockApi';

import { resolveDataSourceUidByName, resolveFolderUidByName } from './nameResolvers';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: jest.fn(),
}));

const server = setupMswServer();

// resolveFolderUidByName dispatches through the global app store singleton (app/store/store),
// which test/test-utils's render() does not populate for plain function calls outside a
// component tree - only rendering a Provider around this API's reducer would. Wire it up
// directly, mirroring the pattern in browseDashboardsAPI.test.ts.
beforeEach(() => {
  const store = configureStore({
    reducer: { [folderSearchAPI.reducerPath]: folderSearchAPI.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(folderSearchAPI.middleware),
  });
  setStore(store as unknown as Store<StoreState>);
});

const FOLDER_SEARCH_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/search';

function mockFolderSearchResults(items: Array<{ name: string; title: string }>) {
  server.use(
    http.post(FOLDER_SEARCH_URL, () =>
      HttpResponse.json({
        items: items.map(({ name, title }) => ({
          resource: { group: 'folder.grafana.app', kind: 'Folder', name, resource: 'folders' },
          fields: { title },
        })),
        metadata: { totalHits: items.length, totalHitsRelation: 'eq' },
      })
    )
  );
}

describe('resolveFolderUidByName', () => {
  it('returns the UID when exactly one folder has that exact title', async () => {
    mockFolderSearchResults([{ name: 'folder-uid-1', title: 'Team Alerts' }]);

    await expect(resolveFolderUidByName('Team Alerts')).resolves.toBe('folder-uid-1');
  });

  it('returns undefined when no folder matches', async () => {
    mockFolderSearchResults([]);

    await expect(resolveFolderUidByName('Nonexistent Folder')).resolves.toBeUndefined();
  });

  it('returns undefined when more than one folder shares that exact title', async () => {
    mockFolderSearchResults([
      { name: 'folder-uid-1', title: 'Team Alerts' },
      { name: 'folder-uid-2', title: 'Team Alerts' },
    ]);

    await expect(resolveFolderUidByName('Team Alerts')).resolves.toBeUndefined();
  });

  it('ignores folders whose title only partially matches', async () => {
    mockFolderSearchResults([{ name: 'folder-uid-1', title: 'Team Alerts Archive' }]);

    await expect(resolveFolderUidByName('Team Alerts')).resolves.toBeUndefined();
  });

  it('returns undefined for an empty name without making a request', async () => {
    const spy = jest.fn();
    server.use(http.post(FOLDER_SEARCH_URL, () => (spy(), HttpResponse.json({ items: [], metadata: {} }))));

    await expect(resolveFolderUidByName('   ')).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('resolveDataSourceUidByName', () => {
  afterEach(() => {
    jest.mocked(getDataSourceInstanceSettings).mockReset();
  });

  it('returns the UID when the resolved settings name matches exactly', async () => {
    jest.mocked(getDataSourceInstanceSettings).mockResolvedValue({
      uid: 'ds-uid-1',
      name: 'Prometheus',
    } as Awaited<ReturnType<typeof getDataSourceInstanceSettings>>);

    await expect(resolveDataSourceUidByName('Prometheus')).resolves.toBe('ds-uid-1');
  });

  it('returns undefined when the input resolves to a different data source (e.g. a UID collision)', async () => {
    jest.mocked(getDataSourceInstanceSettings).mockResolvedValue({
      uid: 'Prometheus',
      name: 'Some Other Name',
    } as Awaited<ReturnType<typeof getDataSourceInstanceSettings>>);

    await expect(resolveDataSourceUidByName('Prometheus')).resolves.toBeUndefined();
  });

  it('returns undefined when nothing resolves', async () => {
    jest.mocked(getDataSourceInstanceSettings).mockResolvedValue(undefined);

    await expect(resolveDataSourceUidByName('Unknown')).resolves.toBeUndefined();
  });

  it('returns undefined for an empty name without calling the lookup', async () => {
    await expect(resolveDataSourceUidByName('  ')).resolves.toBeUndefined();
    expect(getDataSourceInstanceSettings).not.toHaveBeenCalled();
  });
});
