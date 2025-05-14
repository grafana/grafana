import { validateDaysOfMonth } from './MuteTimingTimeInterval';

describe('validateDaysOfMonth', () => {
  it('should return true for valid empty value', () => {
    expect(validateDaysOfMonth('')).toBe(true);
    expect(validateDaysOfMonth(undefined)).toBe(true);
  });

  it('should return true for valid single days', () => {
    expect(validateDaysOfMonth('1')).toBe(true);
    expect(validateDaysOfMonth('15')).toBe(true);
    expect(validateDaysOfMonth('31')).toBe(true);
    expect(validateDaysOfMonth('-1')).toBe(true);
    expect(validateDaysOfMonth('-30')).toBe(true);
  });

  it('should return true for valid day ranges', () => {
    expect(validateDaysOfMonth('1:5')).toBe(true);
    expect(validateDaysOfMonth('1:5, 10:15')).toBe(true);
    expect(validateDaysOfMonth('1:5, 10, 15, 20:25')).toBe(true);
    expect(validateDaysOfMonth('1:5,10:15')).toBe(true);
    expect(validateDaysOfMonth('1:5,10,15,20:25')).toBe(true);
    expect(validateDaysOfMonth('-30:-1')).toBe(true);
  });

  it('should return true for valid mixed positive and negative days', () => {
    expect(validateDaysOfMonth('1, -1')).toBe(true);
    expect(validateDaysOfMonth('1:5, -10, -15')).toBe(true);
    expect(validateDaysOfMonth('1,-1')).toBe(true);
    expect(validateDaysOfMonth('1:5,-10,-15')).toBe(true);
  });

  it('should return error message for invalid format with non-numeric characters', () => {
    expect(validateDaysOfMonth('1a')).toBe('Invalid day');
    expect(validateDaysOfMonth('a')).toBe('Invalid day');
    expect(validateDaysOfMonth('1-5')).toBe('Invalid day');
    expect(validateDaysOfMonth('1 5')).toBe('Invalid day');
    expect(validateDaysOfMonth('1..5')).toBe('Invalid day');
  });

  it('should return error message for out of range days', () => {
    expect(validateDaysOfMonth('0')).toBe('Invalid day');
    expect(validateDaysOfMonth('32')).toBe('Invalid day');
    expect(validateDaysOfMonth('-32')).toBe('Invalid day');
    expect(validateDaysOfMonth('-0')).toBe('Invalid day');
  });

  it('should return error message for mixed valid and invalid days', () => {
    expect(validateDaysOfMonth('1, 32')).toBe('Invalid day');
    expect(validateDaysOfMonth('1:5, 15a')).toBe('Invalid day');
    expect(validateDaysOfMonth('1, abc')).toBe('Invalid day');
  });
});
