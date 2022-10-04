import { isValidGoDuration, isValidPrometheusDuration } from './time';

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

describe('isValidGoDuration', () => {
  const validDurations = ['20h30m10s45ms', '1m30s', '20s4h', '90s', '10s', '20h20h'];

  it.each(validDurations)('%s should be valid', (duration) => {
    expect(isValidGoDuration(duration)).toBe(true);
  });

  const invalidDurations = ['20h 30m 10s 45ms', '2d4h20m', 'sample text', 'h'];

  it.each(invalidDurations)('%s should NOT be valid', (duration) => {
    expect(isValidGoDuration(duration)).toBe(false);
  });
});
