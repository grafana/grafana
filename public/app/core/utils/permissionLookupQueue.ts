export const PERMISSION_LOOKUP_CONCURRENCY = 4;

const queued = new Set<() => void>();
let running = 0;

function drain() {
  while (running < PERMISSION_LOOKUP_CONCURRENCY) {
    const next = queued.values().next().value;
    if (!next) {
      return;
    }
    queued.delete(next);
    next();
  }
}

function release() {
  running--;
  drain();
}

/** Bounds network work independently of how RTK Query initiates a lookup. */
export function schedulePermissionLookup<T>(lookup: () => T | PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      queued.delete(start);
      signal.removeEventListener('abort', cancel);
      reject(signal.reason ?? new DOMException('Permission lookup aborted', 'AbortError'));
    };
    const start = () => {
      signal.removeEventListener('abort', cancel);
      if (signal.aborted) {
        cancel();
        return;
      }
      running++;
      // The returned promise owns completion and errors from the scheduled work.
      void Promise.resolve()
        .then(lookup)
        .then(
          (value) => {
            release();
            resolve(value);
          },
          (error: unknown) => {
            release();
            reject(error);
          }
        );
    };

    if (signal.aborted) {
      cancel();
      return;
    }
    signal.addEventListener('abort', cancel, { once: true });
    queued.add(start);
    drain();
  });
}
