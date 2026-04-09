import { configureStore } from '@reduxjs/toolkit';
import { of } from 'rxjs';

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
  });

  it('evicts a cached getFolder entry after deleting that folder', async () => {
    const store = createTestStore();
    const folderQueryArg = { name: 'folder-1' };

    await store.dispatch(
      folderAPIv1beta1.util.upsertQueryData('getFolder', folderQueryArg, { metadata: { name: 'folder-1' } } as never)
    );
    expect(folderAPIv1beta1.endpoints.getFolder.select(folderQueryArg)(store.getState()).status).toBe('fulfilled');

    mockFetch.mockReturnValueOnce(of({ data: {} }));

    await store.dispatch(folderAPIv1beta1.endpoints.deleteFolder.initiate({ name: 'folder-1' }));

    expect(folderAPIv1beta1.endpoints.getFolder.select(folderQueryArg)(store.getState()).status).toBe('uninitialized');
  });
});
