import { configureStore } from '@reduxjs/toolkit';
import { of } from 'rxjs';

import { deletedFoldersState } from 'app/features/search/service/deletedDashboardsCache';

import { folderAPIv1beta1 } from './index';

const mockFetch = jest.fn();
const mockGet = jest.fn().mockResolvedValue({});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    fetch: mockFetch,
    get: mockGet,
  }),
}));

describe('folderAPIv1beta1 cache invalidation', () => {
  const createTestStore = () =>
    configureStore({
      reducer: {
        [folderAPIv1beta1.reducerPath]: folderAPIv1beta1.reducer,
      },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(folderAPIv1beta1.middleware),
    });

  beforeEach(() => {
    mockFetch.mockReset();
    mockGet.mockResolvedValue({
      versions: [{ version: 'v1beta1', groupVersion: 'folder.grafana.app/v1beta1' }],
      preferredVersion: { version: 'v1beta1', groupVersion: 'folder.grafana.app/v1beta1' },
    });
    deletedFoldersState.clear();
  });

  it('does not refetch an active getFolder subscription after deleting that folder', async () => {
    const store = createTestStore();
    const folderQueryArg = { name: 'folder-1' };

    mockFetch.mockImplementation(({ method, url }) => {
      if (method === 'DELETE') {
        return of({ data: {} });
      }

      if (url === '/apis/folder.grafana.app/v1beta1/namespaces/default/folders/folder-1') {
        return of({ data: { metadata: { name: 'folder-1' } } });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const subscription = store.dispatch(folderAPIv1beta1.endpoints.getFolder.initiate(folderQueryArg));
    await subscription;
    await store.dispatch(folderAPIv1beta1.endpoints.deleteFolder.initiate({ name: 'folder-1' }));

    expect(mockFetch.mock.calls).toHaveLength(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'GET',
        url: '/apis/folder.grafana.app/v1beta1/namespaces/default/folders/folder-1',
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'DELETE',
        url: '/apis/folder.grafana.app/v1beta1/namespaces/default/folders/folder-1',
      })
    );
    expect(deletedFoldersState.isDeleted('folder-1')).toBe(true);

    subscription.unsubscribe();
  });
});
