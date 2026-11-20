import { configureStore } from '@reduxjs/toolkit';
import { of } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';

import { generatedAPI } from './index';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const page = (continueToken?: string) => ({
  items: [],
  metadata: { totalHits: 0, totalHitsRelation: 'eq', ...(continueToken ? { continue: continueToken } : {}) },
});

describe('searchGlobal', () => {
  it('sends the previous page cursor and stops when the response has none', async () => {
    const fetch = jest
      .fn()
      .mockReturnValueOnce(of({ data: page('page-2') }))
      .mockReturnValueOnce(of({ data: page() }));
    jest.mocked(getBackendSrv).mockReturnValue({ ...getBackendSrv(), fetch });
    const store = configureStore({
      reducer: { [generatedAPI.reducerPath]: generatedAPI.reducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(generatedAPI.middleware),
    });

    try {
      const first = await store.dispatch(generatedAPI.endpoints.searchGlobal.initiate({ limit: 1 })).unwrap();
      expect(first.pages).toHaveLength(1);
      expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'POST', data: { limit: 1 } }));

      const second = await store
        .dispatch(generatedAPI.endpoints.searchGlobal.initiate({ limit: 1 }, { direction: 'forward' }))
        .unwrap();
      expect(second.pages).toHaveLength(2);
      expect(fetch).toHaveBeenLastCalledWith(
        expect.objectContaining({ method: 'POST', data: { limit: 1, continue: 'page-2' } })
      );

      await store
        .dispatch(generatedAPI.endpoints.searchGlobal.initiate({ limit: 1 }, { direction: 'forward' }))
        .unwrap();
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      store.dispatch(generatedAPI.util.resetApiState());
    }
  });
});
