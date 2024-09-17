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
    ['1d10h17m36s789ms', 123456789],
    ['1w4d10h20m54s321ms', 987654321],
    ['1y1w1d1h1m1s1ms', 32230861001],
  ];
  test.each(tests)('.parsePrometheusDuration(%s)', (input, expected) => {
    expect(parsePrometheusDuration(input)).toBe(expected);
  });
});

describe('formatPrometheusDuration', () => {
  it('should return "0s" for 0 milliseconds', () => {
    const result = formatPrometheusDuration(0);
    expect(result).toBe('0s');
  });

  const tests: Array<[number, string]> = [
    [0, '0s'],
    [1000, '1s'],
    [60000, '1m'],
    [3600000, '1h'],
    [86400000, '1d'],
    [604800000, '1w'],
    [31536000000, '1y'],
    [123456789, '1d10h17m36s789ms'],
    [987654321, '1w4d10h20m54s321ms'],
    [32230861001, '1y1w1d1h1m1s1ms'],
  ];
  test.each(tests)('.formatPrometheusDuration(%s)', (input, expected) => {
    expect(formatPrometheusDuration(input)).toBe(expected);
  });
});
