export enum StPodStatus {
  Unknown = 'unknown',
  Waiting = 'waiting',
  Ready = 'ready',
  Timeout = 'timeout',
}

export const ST_POD_TIMEOUT_MS = 5 * 60 * 1000;
export const ST_POD_POLL_INTERVAL_MS = 10 * 1000;

let status: StPodStatus = StPodStatus.Unknown;

let pending: { promise: Promise<void>; resolve: () => void } | null = null;

const listeners = new Set<() => void>();

const setStatus = (next: StPodStatus): void => {
  if (status === next) {
    return;
  }
  status = next;
  listeners.forEach((listener) => listener());
};

export const getStPodStatus = (): StPodStatus => {
  return status;
};

export const subscribeToStPodStatus = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const invalidateStPodReadiness = (): void => {
  pending = null;
  setStatus(StPodStatus.Unknown);
};

export const getStPodReadyPromise = (): Promise<void> => {
  if (status === StPodStatus.Ready) {
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
  if (status === StPodStatus.Ready || status === StPodStatus.Timeout) {
    pending = null;
  }
  setStatus(StPodStatus.Waiting);
};

export const markStPodReady = (): void => {
  setStatus(StPodStatus.Ready);
  pending?.resolve();
};

export const markStPodTimeout = (): void => {
  setStatus(StPodStatus.Timeout);
  pending?.resolve();
};

export interface StPodTimeoutError extends Error {
  stPodTimeout: true;
}

export const createStPodTimeoutError = (): StPodTimeoutError =>
  Object.assign(new Error('The single-tenant pod did not become ready in time'), {
    stPodTimeout: true as const,
  });
