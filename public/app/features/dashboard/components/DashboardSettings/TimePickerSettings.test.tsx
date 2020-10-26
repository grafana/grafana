import { isValidTimeSpanInput } from './TimePickerSettings';

describe('isValidTimeSpanInput', () => {
  const timeUnits = ['ms', 's', 'm', 'h', 'd', 'w', 'M', 'y'];

  it.each(timeUnits)('should return true given a number followed by time unit %s', unit => {
    expect(isValidTimeSpanInput(`5${unit}`)).toBe(true);
  });

  it('should return true given an empty string', () => {
    expect(isValidTimeSpanInput('')).toBe(true);
  });

  it('should return false given an invalid time unit', () => {
    expect(isValidTimeSpanInput('5md')).toBe(false);
  });

  it('should return false given a number but no time unit', () => {
    expect(isValidTimeSpanInput('5')).toBe(false);
  });

  it('should return false given a time unit but no number', () => {
    expect(isValidTimeSpanInput('d')).toBe(false);
  });

  it('should return false given an input with leading zeros', () => {
    expect(isValidTimeSpanInput('05d')).toBe(false);
  });

  it('should return false given a valid input with leading whitespace', () => {
    expect(isValidTimeSpanInput(' 5d')).toBe(false);
  });

  it('should return true given a valid input with trailing whitespace', () => {
    expect(isValidTimeSpanInput('5d ')).toBe(true);
  });
});
