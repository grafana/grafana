import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';

import { folderAPIVersionResolver } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { folderAPIv1beta1 } from './index';

setBackendSrv(backendSrv);
setupMockServer();

describe('folderAPIv1beta1 cache invalidation', () => {
  const createTestStore = () =>
    configureStore({
      reducer: {
        [folderAPIv1beta1.reducerPath]: folderAPIv1beta1.reducer,
      },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(folderAPIv1beta1.middleware),
    });

  beforeEach(() => {
    folderAPIVersionResolver.set('v1beta1');
  });

  it('does not refetch an active getFolder subscription after deleting that folder', async () => {
    const store = createTestStore();
    const folderQueryArg = { name: 'folder-1' };

    const getFolderSpy = jest.fn();
    const deleteFolderSpy = jest.fn();
    server.use(
      http.get('/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/folder-1', () => {
        getFolderSpy();
        return HttpResponse.json({ metadata: { name: 'folder-1' } });
      }),
      http.delete('/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/folder-1', () => {
        deleteFolderSpy();
        return HttpResponse.json({});
      })
    );

    const subscription = store.dispatch(folderAPIv1beta1.endpoints.getFolder.initiate(folderQueryArg));
    await subscription;
    await store.dispatch(folderAPIv1beta1.endpoints.deleteFolder.initiate({ name: 'folder-1' }));

    expect(getFolderSpy).toHaveBeenCalledTimes(1);
    expect(deleteFolderSpy).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
  });
});
