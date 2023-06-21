export const isFulfilled = <T>(promise: PromiseSettledResult<T>): promise is PromiseFulfilledResult<T> =>
  promise.status === 'fulfilled';

// TS<5 does not support `in` operator for type narrowing. once we upgrade to TS5, we can remove this function and just use the in operator instead.
export function hasKey<K extends string, T extends object>(k: K, o: T): o is T & Record<K, unknown> {
  return k in o;
}
