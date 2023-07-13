import { validateInterval, validateIntervalRegex } from './validation';

describe('Validation', () => {
  it('should validate incorrect values correctly', () => {
    expect(validateInterval('-', validateIntervalRegex)).toBeTruthy();
    expect(validateInterval('1', validateIntervalRegex)).toBeTruthy();
    expect(validateInterval('test', validateIntervalRegex)).toBeTruthy();
    expect(validateInterval('1ds', validateIntervalRegex)).toBeTruthy();
    expect(validateInterval('10Ms', validateIntervalRegex)).toBeTruthy();
    expect(validateInterval('-9999999', validateIntervalRegex)).toBeTruthy();
  });

  it('should validate correct values correctly', () => {
    expect(validateInterval('1y', validateIntervalRegex)).toBeFalsy();
    expect(validateInterval('1M', validateIntervalRegex)).toBeFalsy();
    expect(validateInterval('1w', validateIntervalRegex)).toBeFalsy();
    expect(validateInterval('1d', validateIntervalRegex)).toBeFalsy();
    expect(validateInterval('2h', validateIntervalRegex)).toBeFalsy();
    expect(validateInterval('4m', validateIntervalRegex)).toBeFalsy();
    expect(validateInterval('8s', validateIntervalRegex)).toBeFalsy();
    expect(validateInterval('80ms', validateIntervalRegex)).toBeFalsy();
    expect(validateInterval('-80ms', validateIntervalRegex)).toBeFalsy();
  });

  it('should not return error if no value provided', () => {
    expect(validateInterval('', validateIntervalRegex)).toBeFalsy();
  });
});
