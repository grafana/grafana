import { isLessThanThreshold, parseAlertThreshold, parseNormalRange } from './parseIntentThresholds';

describe('parseAlertThreshold', () => {
  it.each([
    ['p99 > 500ms for 5m', 500],
    ['error rate > 5%', 5],
    ['memory > 2GB', 2],
    ['> 250', 250],
    ['1000', 1000],
    ['0.5', 0.5],
  ])('extracts numeric value from %s → %f', (input, expected) => {
    expect(parseAlertThreshold(input)).toBe(expected);
  });

  it.each([
    ['spike'],
    ['high load'],
    [''],
    [undefined],
    ['no numbers here at all'],
  ])('returns undefined for non-numeric input %s', (input) => {
    expect(parseAlertThreshold(input)).toBeUndefined();
  });
});

describe('parseNormalRange', () => {
  it.each([
    ['10–20 logins/min', { min: 10, max: 20 }],
    ['100-200ms', { min: 100, max: 200 }],
    ['50 to 80', { min: 50, max: 80 }],
    ['1.5–3.0', { min: 1.5, max: 3.0 }],
    ['0 to 100%', { min: 0, max: 100 }],
  ])('parses %s → %o', (input, expected) => {
    expect(parseNormalRange(input)).toEqual(expected);
  });

  it.each([
    ['p99 < 250ms'],  // single value — not a range
    ['spike'],
    [''],
    [undefined],
    ['100-50'],       // min >= max — invalid range
    ['no numbers'],
  ])('returns undefined for non-range input %s', (input) => {
    expect(parseNormalRange(input)).toBeUndefined();
  });
});

describe('isLessThanThreshold', () => {
  it.each([
    ['< 10', true],
    ['<= 5', true],
    ['< 200ms', true],
    ['> 80', false],
    ['>= 90', false],
    ['500', false],
    ['p99 > 500ms', false],
    [undefined, false],
    ['', false],
  ])('classifies %s as less-than: %s', (input, expected) => {
    expect(isLessThanThreshold(input)).toBe(expected);
  });
});
