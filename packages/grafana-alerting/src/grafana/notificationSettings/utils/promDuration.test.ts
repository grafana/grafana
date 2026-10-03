import { isValidPromDuration, parsePromDuration } from './promDuration';

describe('isValidPromDuration', () => {
  // Same cases as the internal source this was ported from (time.test.ts), so behavior stays
  // provably identical for anyone who's used the internal validator before.
  it.each(['20h30m10s45ms', '1m30s', '20s4h', '90s', '10s', '20h20h', '2d4h20m'])('accepts %s', (value) => {
    expect(isValidPromDuration(value)).toBe(true);
  });

  it.each(['', undefined])('treats empty/undefined as valid (optional field)', (value) => {
    expect(isValidPromDuration(value)).toBe(true);
  });

  it.each(['20h 30m 10s 45ms', '10Y', 'sample text', 'm'])('rejects %s', (value) => {
    expect(isValidPromDuration(value)).toBe(false);
  });
});

describe('parsePromDuration', () => {
  it.each([
    ['1ms', 1],
    ['1s', 1000],
    ['1m', 1000 * 60],
    ['1h', 1000 * 60 * 60],
    ['1d', 1000 * 60 * 60 * 24],
    ['1w', 1000 * 60 * 60 * 24 * 7],
    ['1y', 1000 * 60 * 60 * 24 * 365],
    ['1d10h17m36s789ms', 123456789],
    ['1w4d10h20m54s321ms', 987654321],
    ['1y1w1d1h1m1s1ms', 32230861001],
  ])('parses %s as %d ms', (input, expected) => {
    expect(parsePromDuration(input)).toBe(expected);
  });
});
