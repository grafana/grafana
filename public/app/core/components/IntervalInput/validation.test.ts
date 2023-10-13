import { isValidInterval, validateIntervalRegex } from './validation';

describe('Validation', () => {
  it('should validate incorrect values correctly', () => {
    expect(isValidInterval('-', validateIntervalRegex)).toBeFalsy();
    expect(isValidInterval('1', validateIntervalRegex)).toBeFalsy();
    expect(isValidInterval('test', validateIntervalRegex)).toBeFalsy();
    expect(isValidInterval('1ds', validateIntervalRegex)).toBeFalsy();
    expect(isValidInterval('10Ms', validateIntervalRegex)).toBeFalsy();
    expect(isValidInterval('-9999999', validateIntervalRegex)).toBeFalsy();
  });

  it('should validate correct values correctly', () => {
    expect(isValidInterval('1y', validateIntervalRegex)).toBeTruthy();
    expect(isValidInterval('1M', validateIntervalRegex)).toBeTruthy();
    expect(isValidInterval('1w', validateIntervalRegex)).toBeTruthy();
    expect(isValidInterval('1d', validateIntervalRegex)).toBeTruthy();
    expect(isValidInterval('2h', validateIntervalRegex)).toBeTruthy();
    expect(isValidInterval('4m', validateIntervalRegex)).toBeTruthy();
    expect(isValidInterval('8s', validateIntervalRegex)).toBeTruthy();
    expect(isValidInterval('80ms', validateIntervalRegex)).toBeTruthy();
    expect(isValidInterval('-80ms', validateIntervalRegex)).toBeTruthy();
  });

  it('should not return error if no value provided', () => {
    expect(isValidInterval('', validateIntervalRegex)).toBeTruthy();
  });
});
