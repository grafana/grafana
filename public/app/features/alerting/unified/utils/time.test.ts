import { formatPrometheusDuration, isValidPrometheusDuration, parsePrometheusDuration } from './time';

describe('isValidPrometheusDuration', () => {
  const validDurations = ['20h30m10s45ms', '1m30s', '20s4h', '90s', '10s', '20h20h', '2d4h20m'];

  it.each(validDurations)('%s should be valid', (duration) => {
    expect(isValidPrometheusDuration(duration)).toBe(true);
  });

  const invalidDurations = ['20h 30m 10s 45ms', '10Y', 'sample text', 'm'];

  it.each(invalidDurations)('%s should NOT be valid', (duration) => {
    expect(isValidPrometheusDuration(duration)).toBe(false);
  });
});

describe('parsePrometheusDuration', () => {
  const tests: Array<[string, number]> = [
    ['1ms', 1],
    ['1s', 1000],
    ['1m', 1000 * 60],
    ['1h', 1000 * 60 * 60],
    ['1d', 1000 * 60 * 60 * 24],
    ['1w', 1000 * 60 * 60 * 24 * 7],
    ['1y', 1000 * 60 * 60 * 24 * 365],
    [
      '1y1w1d1h1m1s1ms',
      1000 * 60 * 60 * 24 * 365 + 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 60 * 24 + 1000 * 60 * 60 + 1000 * 60 + 1000 + 1,
    ],
  ];
  test.each(tests)('.parsePrometheusDuration(%s)', (input, expected) => {
    expect(parsePrometheusDuration(input)).toBe(expected);
  });
});

describe('formatPrometheusDuration', () => {
  const tests: Array<[string, number]> = [
    ['1ms', 1],
    ['1s', 1000],
    ['1m', 1000 * 60],
    ['1h', 1000 * 60 * 60],
    ['1d', 1000 * 60 * 60 * 24],
    ['1w', 1000 * 60 * 60 * 24 * 7],
    ['1y', 1000 * 60 * 60 * 24 * 365],
    [
      '1y1w1d1h1m1s1ms',
      1000 * 60 * 60 * 24 * 365 + 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 60 * 24 + 1000 * 60 * 60 + 1000 * 60 + 1000 + 1,
    ],
  ];
  test.each(tests)('.formatPrometheusDuration(%s)', (expected, input) => {
    expect(formatPrometheusDuration(input)).toBe(expected);
  });
});
