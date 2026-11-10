import { configureStore } from '@reduxjs/toolkit';
import { of } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';

import { generatedAPI } from './index';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

describe('updateDashboardPreferences', () => {
  it.each([
    {
      desc: 'sends an object patch as a merge patch',
      patch: { spec: { dashboard: { preload: true } } },
      contentType: 'application/merge-patch+json',
    },
    {
      desc: 'sends an operation list as a JSON patch',
      patch: [{ op: 'replace', path: '/spec/dashboard/preload', value: true }],
      contentType: 'application/json-patch+json',
    },
  ])('$desc', async ({ patch, contentType }) => {
    const fetch = jest.fn().mockReturnValue(of({ data: {} }));
    jest.mocked(getBackendSrv).mockReturnValue({ ...getBackendSrv(), fetch });
    const store = configureStore({
      reducer: { [generatedAPI.reducerPath]: generatedAPI.reducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(generatedAPI.middleware),
    });

    try {
      await store
        .dispatch(generatedAPI.endpoints.updateDashboardPreferences.initiate({ name: 'namespace', patch }))
        .unwrap();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'PATCH', data: patch, headers: { 'Content-Type': contentType } })
      );
    } finally {
      store.dispatch(generatedAPI.util.resetApiState());
    }
  });
});
