import { validateTimeShift } from './validation';

describe('Validation', () => {
  it('should validate incorrect values correctly', () => {
    expect(validateTimeShift('-')).toBeTruthy();
    expect(validateTimeShift('1')).toBeTruthy();
    expect(validateTimeShift('test')).toBeTruthy();
    expect(validateTimeShift('1ds')).toBeTruthy();
    expect(validateTimeShift('10Ms')).toBeTruthy();
    expect(validateTimeShift('-9999999')).toBeTruthy();
  });

  it('should validate correct values correctly', () => {
    expect(validateTimeShift('1y')).toBeFalsy();
    expect(validateTimeShift('1M')).toBeFalsy();
    expect(validateTimeShift('1w')).toBeFalsy();
    expect(validateTimeShift('1d')).toBeFalsy();
    expect(validateTimeShift('2h')).toBeFalsy();
    expect(validateTimeShift('4m')).toBeFalsy();
    expect(validateTimeShift('8s')).toBeFalsy();
    expect(validateTimeShift('80ms')).toBeFalsy();
    expect(validateTimeShift('-80ms')).toBeFalsy();
  });

  it('should not return error if no value provided', () => {
    expect(validateTimeShift('')).toBeFalsy();
  });
});
