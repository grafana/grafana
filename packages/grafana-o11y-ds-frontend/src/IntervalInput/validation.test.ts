import { validateInterval } from './validation';

describe('Validation', () => {
  it('should validate incorrect values correctly', () => {
    expect(validateInterval('-')).toBeTruthy();
    expect(validateInterval('1')).toBeTruthy();
    expect(validateInterval('test')).toBeTruthy();
    expect(validateInterval('1ds')).toBeTruthy();
    expect(validateInterval('10Ms')).toBeTruthy();
    expect(validateInterval('-9999999')).toBeTruthy();
  });

  it('should validate correct values correctly', () => {
    expect(validateInterval('1y')).toBeFalsy();
    expect(validateInterval('1M')).toBeFalsy();
    expect(validateInterval('1w')).toBeFalsy();
    expect(validateInterval('1d')).toBeFalsy();
    expect(validateInterval('2h')).toBeFalsy();
    expect(validateInterval('4m')).toBeFalsy();
    expect(validateInterval('8s')).toBeFalsy();
    expect(validateInterval('80ms')).toBeFalsy();
    expect(validateInterval('-80ms')).toBeFalsy();
  });

  it('should not return error if no value provided', () => {
    expect(validateInterval('')).toBeFalsy();
  });
});
