import { configureStore } from '@reduxjs/toolkit';
import { waitFor } from '@testing-library/react';
import { of } from 'rxjs';

import { type BackendSrv, getBackendSrv, setBackendSrv } from '@grafana/runtime';

it('supports endpoint injection and tag-driven refetch after base-only store registration', async () => {
  const { allMiddleware, allReducers } = await import('./registration');
  const { api } = await import('./preferences/org/baseAPI');

  expect(Object.keys(allReducers)).toContain(api.reducerPath);
  expect(api.endpoints).toEqual({});

  const store = configureStore({
    reducer: allReducers,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(...allMiddleware),
  });
  const { generatedAPI } = await import('./preferences/org');

  expect(generatedAPI).toBe(api);
  expect(allReducers[generatedAPI.reducerPath]).toBe(generatedAPI.reducer);
  expect(allMiddleware).toContain(generatedAPI.middleware);

  const originalBackendSrv = getBackendSrv();
  const fetch = jest
    .fn()
    .mockReturnValueOnce(of({ data: { theme: 'dark' } }))
    .mockReturnValueOnce(of({ data: { message: 'Preferences updated' } }))
    .mockReturnValueOnce(of({ data: { theme: 'light' } }));
  setBackendSrv({ fetch } as unknown as BackendSrv);

  const query = store.dispatch(generatedAPI.endpoints.getOrgPreferences.initiate());
  try {
    await expect(query.unwrap()).resolves.toEqual({ theme: 'dark' });
    expect(fetch).toHaveBeenNthCalledWith(1, expect.objectContaining({ url: '/api/org/preferences', method: 'GET' }));

    const mutation = store.dispatch(
      generatedAPI.endpoints.updateOrgPreferences.initiate({ updatePrefsCmd: { theme: 'light' } })
    );
    await mutation.unwrap();

    await waitFor(() =>
      expect(generatedAPI.endpoints.getOrgPreferences.select()(store.getState()).data).toEqual({ theme: 'light' })
    );
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ url: '/api/org/preferences', method: 'PUT', data: { theme: 'light' } })
    );
    mutation.reset();

    const populated = await import('./index');
    expect(allReducers).toEqual(populated.allReducers);
    expect(allMiddleware).toEqual(populated.allMiddleware);
  } finally {
    query.unsubscribe();
    store.dispatch(generatedAPI.util.resetApiState());
    setBackendSrv(originalBackendSrv);
  }
});
