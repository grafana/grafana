import { schedulePermissionLookup } from './permissionLookupQueue';

it('releases slots after synchronous and asynchronous failures', async () => {
  const failure = new Error('Lookup failed');
  const signal = new AbortController().signal;

  await expect(
    schedulePermissionLookup(() => {
      throw failure;
    }, signal)
  ).rejects.toBe(failure);
  await expect(schedulePermissionLookup(() => Promise.reject(failure), signal)).rejects.toBe(failure);
  await expect(
    Promise.all(Array.from({ length: 8 }, (_, index) => schedulePermissionLookup(() => index, signal)))
  ).resolves.toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
});

it('does not start an already aborted lookup', async () => {
  const controller = new AbortController();
  const lookup = jest.fn();
  controller.abort();

  await expect(schedulePermissionLookup(lookup, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(lookup).not.toHaveBeenCalled();
});

it('skips an aborted queued lookup without blocking subsequent work', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const running = Array.from({ length: 4 }, () => schedulePermissionLookup(() => gate, new AbortController().signal));
  const controller = new AbortController();
  const lookup = jest.fn();
  const cancelled = schedulePermissionLookup(lookup, controller.signal);
  const next = schedulePermissionLookup(() => 'next', new AbortController().signal);

  try {
    const rejected = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(lookup).not.toHaveBeenCalled();
  } finally {
    release();
    await Promise.all(running);
  }
  await expect(next).resolves.toBe('next');
});
