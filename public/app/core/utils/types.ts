type Truthy<T> = T extends false | '' | 0 | null | undefined ? never : T;

export const isTruthy = <T>(value: T): value is Truthy<T> => Boolean(value);

type NotNullish<T> = T extends null | undefined ? never : T;

/**
 * return `false` for `null` and `undefined`, and return `true` for everything else
 */
export const isNotNullish = <T>(value: T): value is NotNullish<T> => value != null; // this covers both `null` and `undefined`
