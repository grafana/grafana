import { extractErrorMessage } from './utils';

describe('extractErrorMessage', () => {
  it('returns data.message properly', () => {
    expect(extractErrorMessage({ data: { message: 'Request failed' } })).toBe('Request failed');
    expect(extractErrorMessage({ data: { message: undefined } })).toBe(undefined);
    expect(extractErrorMessage({ data: { message: undefined } }, 'fallback')).toBe('fallback');
  });

  it('returns top-level message when present', () => {
    expect(extractErrorMessage({ message: 'Top level error' })).toBe('Top level error');
  });

  it('returns string error values as-is', () => {
    expect(extractErrorMessage('plain string error')).toBe('plain string error');
    expect(extractErrorMessage('')).toBe('');
  });

  it('return extracts message from Error instances', () => {
    expect(extractErrorMessage(new Error('test error'))).toBe('test error');
  });

  it('returns undefined for missing or invalid object error shapes', () => {
    expect(extractErrorMessage(null)).toBeUndefined();
    expect(extractErrorMessage({})).toBeUndefined();
    expect(extractErrorMessage({ data: {} })).toBeUndefined();
    expect(extractErrorMessage(0)).toBeUndefined();
    expect(extractErrorMessage(false)).toBeUndefined();
    expect(extractErrorMessage({ data: 'bad-shape' })).toBeUndefined();
    expect(extractErrorMessage(undefined)).toBeUndefined();
  });

  it('stringifies non-string message values', () => {
    expect(extractErrorMessage({ message: 404 })).toBe('404');
    expect(extractErrorMessage({ data: { message: false } }, 'fallback')).toBe('false');
    expect(extractErrorMessage({ message: 0 }, 'fallback')).toBe('0');
  });

  it('returns fallback message when no error message is present', () => {
    expect(extractErrorMessage(null, 'fallback message')).toBe('fallback message');
    expect(extractErrorMessage({}, 'fallback message')).toBe('fallback message');
    expect(extractErrorMessage(false, 'fallback message')).toBe('fallback message');
    expect(extractErrorMessage(undefined, 'fallback message')).toBe('fallback message');
  });
});
