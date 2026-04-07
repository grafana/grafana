import { truncateText } from './truncateText';

describe('truncateText', () => {
  it('returns the original string when shorter than maxLength', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('truncates and appends ellipsis when longer than maxLength', () => {
    expect(truncateText('hello world', 8)).toBe('hello w…');
  });

  it('returns empty string for empty input', () => {
    expect(truncateText('', 10)).toBe('');
  });

  it('returns empty string when maxLength is zero', () => {
    expect(truncateText('hello', 0)).toBe('');
  });

  it('returns empty string when maxLength is negative', () => {
    expect(truncateText('hello', -1)).toBe('');
  });
});
