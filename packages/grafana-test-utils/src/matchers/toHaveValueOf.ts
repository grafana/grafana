import { matcherHint, printExpected, printReceived } from 'jest-matcher-utils';

/**
 * Passes when `received.valueOf()` strictly equals `expectedValue`.
 *
 * Useful for asserting that date-like objects (e.g. `DateTime` from `@grafana/data`) point at an
 * exact epoch-millisecond timestamp without reaching into implementation details. Assertions like
 * `expect.objectContaining({ _i: 1675987200000 })` relied on moment.js internals and broke when
 * `DateTime` moved to a luxon-backed implementation; `valueOf()` is part of the public contract of
 * both, so this matcher is implementation-agnostic.
 *
 * Works both as a regular matcher and as an asymmetric matcher:
 *
 *   expect(dateTime(0)).toHaveValueOf(0);
 *   expect(range).toEqual(expect.objectContaining({ from: expect.toHaveValueOf(0) }));
 */
export function toHaveValueOf(received: { valueOf(): unknown }, expectedValue: unknown): jest.CustomMatcherResult {
  const receivedValue = received.valueOf();
  const pass = receivedValue === expectedValue;

  return {
    pass,
    message: () =>
      pass
        ? `${matcherHint('.not.toHaveValueOf')}

  Expected valueOf() ${printReceived(receivedValue)} not to equal ${printExpected(expectedValue)}`
        : `${matcherHint('.toHaveValueOf')}

  Expected valueOf() ${printReceived(receivedValue)} to equal ${printExpected(expectedValue)}`,
  };
}
