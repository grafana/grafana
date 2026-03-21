import { extractErrorMessage } from './utils';

describe('extractErrorMessage', () => {
  it('returns data.message when present', () => {
    expect(extractErrorMessage({ data: { message: 'Request failed' } })).toBe('Request failed');
  });

  it('returns top-level message when present', () => {
    expect(extractErrorMessage({ message: 'Top level error' })).toBe('Top level error');
  });

  it('returns string error values as-is', () => {
    expect(extractErrorMessage('plain string error')).toBe('plain string error');
  });

  it('returns undefined for missing or invalid object error shapes', () => {
    expect(extractErrorMessage(null)).toBeUndefined();
    expect(extractErrorMessage({})).toBeUndefined();
    expect(extractErrorMessage({ data: {} })).toBeUndefined();
    expect(extractErrorMessage(0)).toBeUndefined();
    expect(extractErrorMessage(false)).toBeUndefined();
    expect(extractErrorMessage({ data: 'bad-shape' })).toBeUndefined();
  });

  it('stringifies non-string message values', () => {
    expect(extractErrorMessage({ message: 404 })).toBe('404');
    expect(extractErrorMessage({ data: { message: false } })).toBe('false');
  });
});
