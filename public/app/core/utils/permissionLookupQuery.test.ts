import { configureStore } from '@reduxjs/toolkit';
import { type BaseQueryFn, createApi, retry } from '@reduxjs/toolkit/query';

import { permissionLookupRetryOptions } from './permissionLookupQuery';
import { PERMISSION_LOOKUP_CONCURRENCY, schedulePermissionLookup } from './permissionLookupQueue';

const cleanups: Array<() => void> = [];

function setup(request: () => ReturnType<BaseQueryFn<void, boolean>>) {
  const baseQuery: BaseQueryFn<void, boolean> = (_args, api) => schedulePermissionLookup(request, api.signal);
  const api = createApi({
    baseQuery: retry(baseQuery, permissionLookupRetryOptions),
    endpoints: (builder) => ({ lookup: builder.query<boolean, void>({ query: () => undefined }) }),
  });
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
  });
  cleanups.push(() => store.dispatch(api.util.resetApiState()));
  return store.dispatch(api.endpoints.lookup.initiate());
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  jest.clearAllTimers();
  jest.useRealTimers();
});

it.each([400, 401, 403, 404])('does not retry a permanent permission error (%s)', async (status) => {
  const error = { status, data: {} };
  const request = jest.fn(async () => ({ error }));

  await expect(setup(request).unwrap()).rejects.toEqual(error);
  expect(request).toHaveBeenCalledTimes(1);
});

it('stops after three transient attempts', async () => {
  const error = { status: 503, data: {} };
  const request = jest.fn(async () => ({ error }));
  const pending = setup(request);

  await jest.runAllTimersAsync();

  await expect(pending.unwrap()).rejects.toEqual(error);
  expect(request).toHaveBeenCalledTimes(3);
});

it('cancels retry backoff without starting another permission request', async () => {
  const request = jest.fn(async () => ({ error: { status: 503, data: {} } }));
  const pending = setup(request);
  await jest.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledTimes(1);

  const rejected = expect(pending.unwrap()).rejects.toMatchObject({ name: 'AbortError' });
  pending.abort();

  await rejected;
  await jest.runAllTimersAsync();
  expect(request).toHaveBeenCalledTimes(1);
});

it('releases all network slots during retry backoff', async () => {
  const controller = new AbortController();
  let failing = true;
  const request = jest.fn(async () => (failing ? { error: { status: 503, data: {} } } : { data: true }));
  const pending = setup(request);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = jest.fn();
  const controls: Array<Promise<void>> = [];

  try {
    await jest.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(1);
    for (let index = 0; index < PERMISSION_LOOKUP_CONCURRENCY; index++) {
      controls.push(
        schedulePermissionLookup(async () => {
          started();
          await gate;
        }, controller.signal)
      );
    }
    await jest.advanceTimersByTimeAsync(0);
    expect(started).toHaveBeenCalledTimes(PERMISSION_LOOKUP_CONCURRENCY);

    release();
    await Promise.all(controls);
    failing = false;
    await jest.runAllTimersAsync();
    await expect(pending.unwrap()).resolves.toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  } finally {
    release();
    controller.abort();
    pending.abort();
    await Promise.all(controls);
    await pending;
  }
});
