/**
 * Stops waiting on `work` after `timeoutMs` and fails with whatever error `onTimeout` returns.
 *
 * The work itself is left running rather than aborted — it may be shared with other callers through
 * a cache, so cancelling it here would take it away from them too. `onTimeout` only runs when the
 * wait is actually given up on, which makes it the right place to log as well.
 */
export async function withTimeout<T>(work: Promise<T>, timeoutMs: number, onTimeout: () => Error): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(onTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}
