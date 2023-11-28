export const isFulfilled = (promise) => promise.status === 'fulfilled';
// TS<5 does not support `in` operator for type narrowing. once we upgrade to TS5, we can remove this function and just use the in operator instead.
export function hasKey(k, o) {
    return k in o;
}
//# sourceMappingURL=utils.js.map