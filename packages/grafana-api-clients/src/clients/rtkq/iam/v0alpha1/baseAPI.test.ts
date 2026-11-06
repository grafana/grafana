import { configureStore } from '@reduxjs/toolkit';
import { of } from 'rxjs';

import { config, getBackendSrv } from '@grafana/runtime';

import { generatedAPI } from './endpoints.gen';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

describe('IAM endpoint routing', () => {
  it('uses the cluster root for whoami and keeps existing endpoints namespaced', async () => {
    const fetch = jest.fn().mockReturnValue(of({ data: {} }));
    jest.mocked(getBackendSrv).mockReturnValue({ ...getBackendSrv(), fetch });
    const store = configureStore({
      reducer: { [generatedAPI.reducerPath]: generatedAPI.reducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(generatedAPI.middleware),
    });

    try {
      await store.dispatch(generatedAPI.endpoints.getWhoAmI.initiate()).unwrap();
      expect(fetch).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: '/apis/iam.grafana.app/v0alpha1/whoami', method: 'GET' })
      );

      await store.dispatch(generatedAPI.endpoints.getCurrentUserDisplay.initiate()).unwrap();
      expect(fetch).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: `/apis/iam.grafana.app/v0alpha1/namespaces/${config.namespace}/users/~` })
      );

      await store.dispatch(generatedAPI.endpoints.getDisplayMapping.initiate({ key: ['user:u1'] })).unwrap();
      expect(fetch).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: `/apis/iam.grafana.app/v0alpha1/namespaces/${config.namespace}/display` })
      );
    } finally {
      store.dispatch(generatedAPI.util.resetApiState());
    }
  });
});
