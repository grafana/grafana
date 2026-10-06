import {
  getStPodReadyPromise,
  getStPodStatus,
  invalidateStPodReadiness,
  markStPodGaveUp,
  markStPodReady,
  markStPodWaiting,
} from './stPodReadiness';

describe('stPodReadiness', () => {
  beforeEach(() => {
    invalidateStPodReadiness();
  });

  it('starts in the unknown status', () => {
    expect(getStPodStatus()).toBe('unknown');
  });

  it('returns the same promise instance on repeated calls while not ready', () => {
    expect(getStPodReadyPromise()).toBe(getStPodReadyPromise());
  });

  it('leaves the promise pending while the pod is not ready', async () => {
    const stillPending = Symbol('still-pending');

    // Promise.race settles with the sentinel only if the readiness promise has not resolved.
    await expect(Promise.race([getStPodReadyPromise(), Promise.resolve(stillPending)])).resolves.toBe(stillPending);
  });

  it('moves from unknown to waiting without replacing the pending promise', () => {
    const before = getStPodReadyPromise();

    markStPodWaiting();

    expect(getStPodStatus()).toBe('waiting');
    expect(getStPodReadyPromise()).toBe(before);
  });

  it('reports ready and resolves the pending promise when the pod is marked ready', async () => {
    const pending = getStPodReadyPromise();

    markStPodReady();

    expect(getStPodStatus()).toBe('ready');
    await expect(pending).resolves.toBeUndefined();
  });

  it('reports gaveUp and also resolves the pending promise when the wait is abandoned', async () => {
    const pending = getStPodReadyPromise();

    markStPodGaveUp();

    expect(getStPodStatus()).toBe('gaveUp');
    // Must resolve even though this is the failure path: a promise left pending keeps the
    // consumer suspended forever, so it never re-renders to reach its error branch.
    await expect(pending).resolves.toBeUndefined();
  });

  it('returns an already-resolved promise once the pod is ready', async () => {
    markStPodReady();

    await expect(getStPodReadyPromise()).resolves.toBeUndefined();
  });

  it('hands out a new promise after being invalidated', () => {
    const before = getStPodReadyPromise();

    invalidateStPodReadiness();

    expect(getStPodStatus()).toBe('unknown');
    expect(getStPodReadyPromise()).not.toBe(before);
  });

  it('can start waiting again after giving up', () => {
    markStPodGaveUp();

    invalidateStPodReadiness();
    markStPodWaiting();

    expect(getStPodStatus()).toBe('waiting');
  });

  it('restores a pending promise when a ready pod goes back to waiting', async () => {
    const resolved = getStPodReadyPromise();
    markStPodReady();

    markStPodWaiting();

    const stillPending = 'still-pending';
    expect(getStPodReadyPromise()).not.toBe(resolved);
    await expect(Promise.race([getStPodReadyPromise(), Promise.resolve(stillPending)])).resolves.toBe(stillPending);
  });
});
