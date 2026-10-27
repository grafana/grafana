import {
  getStPodReadyPromise,
  getStPodStatus,
  invalidateStPodReadiness,
  markStPodReady,
  markStPodTimeout,
  markStPodWaiting,
  StPodStatus,
  subscribeToStPodStatus,
} from './stPodReadiness';

describe('stPodReadiness', () => {
  beforeEach(() => {
    invalidateStPodReadiness();
  });

  it('starts in the unknown status', () => {
    expect(getStPodStatus()).toBe(StPodStatus.Unknown);
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

    expect(getStPodStatus()).toBe(StPodStatus.Waiting);
    expect(getStPodReadyPromise()).toBe(before);
  });

  it('reports ready and resolves the pending promise when the pod is marked ready', async () => {
    const pending = getStPodReadyPromise();

    markStPodReady();

    expect(getStPodStatus()).toBe(StPodStatus.Ready);
    await expect(pending).resolves.toBeUndefined();
  });

  it('reports timeout and also resolves the pending promise when the wait is abandoned', async () => {
    const pending = getStPodReadyPromise();

    markStPodTimeout();

    expect(getStPodStatus()).toBe(StPodStatus.Timeout);
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

    expect(getStPodStatus()).toBe(StPodStatus.Unknown);
    expect(getStPodReadyPromise()).not.toBe(before);
  });

  it('can start waiting again after timing out', () => {
    markStPodTimeout();

    invalidateStPodReadiness();
    markStPodWaiting();

    expect(getStPodStatus()).toBe(StPodStatus.Waiting);
  });

  it('restores a pending promise when a ready pod goes back to waiting', async () => {
    const resolved = getStPodReadyPromise();
    markStPodReady();

    markStPodWaiting();

    const stillPending = 'still-pending';
    expect(getStPodReadyPromise()).not.toBe(resolved);
    await expect(Promise.race([getStPodReadyPromise(), Promise.resolve(stillPending)])).resolves.toBe(stillPending);
  });

  it('hands out a fresh pending promise after markStPodWaiting recovers from timeout', async () => {
    const before = getStPodReadyPromise();
    markStPodTimeout();

    markStPodWaiting();

    // A fresh waiting state must produce a fresh pending promise, otherwise a
    // consumer that already saw the resolved timeout promise would never suspend
    // again on the new attempt.
    const after = getStPodReadyPromise();
    expect(after).not.toBe(before);

    const stillPending = Symbol('still-pending');
    await expect(Promise.race([after, Promise.resolve(stillPending)])).resolves.toBe(stillPending);
  });

  describe('subscribeToStPodStatus', () => {
    let unsubscribe: (() => void) | undefined;

    afterEach(() => {
      unsubscribe?.();
      unsubscribe = undefined;
    });

    it.each([
      ['waiting', markStPodWaiting, StPodStatus.Waiting],
      ['ready', markStPodReady, StPodStatus.Ready],
      ['timeout', markStPodTimeout, StPodStatus.Timeout],
    ])('notifies once, with the new status already set, when the pod is marked %s', (_, mark, expected) => {
      const seen: StPodStatus[] = [];
      unsubscribe = subscribeToStPodStatus(() => seen.push(getStPodStatus()));

      mark();

      expect(seen).toEqual([expected]);
    });

    it('notifies when a timed-out pod is invalidated so mounted consumers can show pending again', () => {
      markStPodTimeout();
      const listener = jest.fn();
      unsubscribe = subscribeToStPodStatus(listener);

      invalidateStPodReadiness();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(getStPodStatus()).toBe(StPodStatus.Unknown);
    });

    it('does not notify when the status does not change', () => {
      markStPodWaiting();
      const listener = jest.fn();
      unsubscribe = subscribeToStPodStatus(listener);

      markStPodWaiting();

      expect(getStPodStatus()).toBe(StPodStatus.Waiting);
      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies every subscriber until it unsubscribes', () => {
      const stays = jest.fn();
      const leaves = jest.fn();
      unsubscribe = subscribeToStPodStatus(stays);
      const stop = subscribeToStPodStatus(leaves);

      markStPodReady();
      stop();
      markStPodTimeout();

      expect(stays).toHaveBeenCalledTimes(2);
      expect(leaves).toHaveBeenCalledTimes(1);
    });
  });
});
