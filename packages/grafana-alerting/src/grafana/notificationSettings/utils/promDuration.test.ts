import { isValidPromDuration, isValidRoutingTimings } from './promDuration';

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

describe('isValidPromDuration with allowZero: false', () => {
  it.each(['0', '0s', '00s', '0ms', '0m0s'])('rejects the zero duration %s', (value) => {
    expect(isValidPromDuration(value, { allowZero: false })).toBe(false);
  });

  it.each(['1s', '1m0s', '10s', '0m1s'])('accepts %s', (value) => {
    expect(isValidPromDuration(value, { allowZero: false })).toBe(true);
  });

  it('still treats empty as valid and malformed as invalid', () => {
    expect(isValidPromDuration('', { allowZero: false })).toBe(true);
    expect(isValidPromDuration('20s4h', { allowZero: false })).toBe(false);
  });
});

describe('isValidPromDuration with allowMilliseconds: false', () => {
  it.each(['500ms', '1m500ms', '0ms'])('rejects %s', (value) => {
    expect(isValidPromDuration(value, { allowMilliseconds: false })).toBe(false);
  });

  it.each(['90s', '1m30s', '2d4h20m', '0', '0s', ''])('accepts %s', (value) => {
    expect(isValidPromDuration(value, { allowMilliseconds: false })).toBe(true);
  });

  it('accepts milliseconds by default', () => {
    expect(isValidPromDuration('500ms')).toBe(true);
  });
});

describe('isValidRoutingTimings', () => {
  // The rules API timing schema has no milliseconds unit.
  it.each(['groupWait', 'groupInterval', 'repeatInterval'] as const)('rejects milliseconds in %s', (field) => {
    expect(isValidRoutingTimings({ [field]: '500ms' })).toBe(false);
  });

  it('accepts unset timings and zero group wait', () => {
    expect(isValidRoutingTimings({})).toBe(true);
    expect(isValidRoutingTimings({ groupWait: '0s', groupInterval: '5m', repeatInterval: '4h' })).toBe(true);
  });

  it.each(['groupInterval', 'repeatInterval'] as const)('rejects a zero %s', (field) => {
    expect(isValidRoutingTimings({ [field]: '0s' })).toBe(false);
  });

  it.each(['groupWait', 'groupInterval', 'repeatInterval'] as const)('rejects a malformed %s', (field) => {
    expect(isValidRoutingTimings({ [field]: '20s4h' })).toBe(false);
  });
});
