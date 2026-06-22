/**
 * pulseErrorMessage extracts a human-readable message from an unknown
 * thrown value (typically an RTK Query / backendSrv error whose body is
 * `{ message: string }`). Uses progressive `in` / typeof narrowing so we
 * never reach for a type assertion (the repo lint forbids `as`), and
 * returns undefined when no message can be found so callers can fall
 * back to a generic string.
 */
export function pulseErrorMessage(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') {
    return undefined;
  }
  if ('data' in err && err.data && typeof err.data === 'object') {
    const { data } = err;
    if ('message' in data && typeof data.message === 'string') {
      return data.message;
    }
  }
  if ('message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return undefined;
}
