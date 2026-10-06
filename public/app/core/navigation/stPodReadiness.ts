export type StPodStatus = 'unknown' | 'waiting' | 'ready' | 'gaveUp';

let status: StPodStatus = 'unknown';

let pending: { promise: Promise<void>; resolve: () => void } | null = null;

export const getStPodStatus = () => {
  return status;
};

export const invalidateStPodReadiness = (): void => {
  status = 'unknown';
  pending = null;
};

export const getStPodReadyPromise = (): Promise<void> => {
  if (status === 'ready') {
    return Promise.resolve();
  }
  if (!pending) {
    let resolve!: () => void;
    const promise = new Promise<void>((res) => {
      resolve = res;
    });
    pending = { promise, resolve };
  }
  return pending.promise;
};

export const markStPodWaiting = (): void => {
  if (status === 'ready') {
    pending = null;
  }
  status = 'waiting';
};

export const markStPodReady = (): void => {
  status = 'ready';
  pending?.resolve();
};

export const markStPodGaveUp = (): void => {
  status = 'gaveUp';
  pending?.resolve();
};
