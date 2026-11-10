import { requestPermissionQuery } from './permissionLookupQuery';
import { PERMISSION_LOOKUP_CONCURRENCY, schedulePermissionLookup } from './permissionLookupQueue';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

it.each([400, 401, 403, 404])('does not retry a permanent permission error (%s)', async (status) => {
  const failure = { error: { status, data: {} } };
  const request = jest.fn(async () => failure);

  await expect(requestPermissionQuery(request, new AbortController().signal)).resolves.toEqual(failure);
  expect(request).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('stops after three transient attempts', async () => {
  const failure = { error: { status: 503, data: {} } };
  const request = jest.fn(async () => failure);
  const pending = requestPermissionQuery(request, new AbortController().signal);

  await jest.advanceTimersByTimeAsync(2000);

  await expect(pending).resolves.toEqual(failure);
  expect(request).toHaveBeenCalledTimes(3);
  expect(jest.getTimerCount()).toBe(0);
});

it('cancels the retry delay without starting another permission request', async () => {
  const controller = new AbortController();
  const failure = { error: { status: 503, data: {} } };
  const request = jest.fn(async () => failure);
  const pending = requestPermissionQuery(request, controller.signal);
  await jest.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledTimes(1);

  controller.abort();

  await expect(pending).resolves.toEqual(failure);
  await jest.advanceTimersByTimeAsync(2000);
  expect(request).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('releases all network slots during retry backoff', async () => {
  const controller = new AbortController();
  let failing = true;
  const request = jest.fn(async () => (failing ? { error: { status: 503, data: {} } } : { data: true }));
  const pending = requestPermissionQuery(request, controller.signal);
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
    await jest.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual({ data: true });
    expect(request).toHaveBeenCalledTimes(2);
  } finally {
    release();
    controller.abort();
    await Promise.all(controls);
    await pending;
  }
});
