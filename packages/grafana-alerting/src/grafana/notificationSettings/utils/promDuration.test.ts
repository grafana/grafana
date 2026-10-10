import { isValidPromDuration } from './promDuration';

describe('isValidPromDuration', () => {
  it.each(['20h30m10s45ms', '1m30s', '90s', '10s', '2d4h20m', '1y1w1d1h1m1s1ms', '0', '0s'])('accepts %s', (value) => {
    expect(isValidPromDuration(value)).toBe(true);
  });

  it.each(['', undefined])('treats empty/undefined as valid (optional field)', (value) => {
    expect(isValidPromDuration(value)).toBe(true);
  });

  // The backend (Prometheus ParseDuration) takes each unit once, from largest to smallest.
  it.each(['20s4h', '20h20h', '30s1m', '1m1m', '20h 30m 10s 45ms', '10Y', 'sample text', 'm', '5m0', '1.5h', '-5m'])(
    'rejects %s',
    (value) => {
      expect(isValidPromDuration(value)).toBe(false);
    }
  );
});
