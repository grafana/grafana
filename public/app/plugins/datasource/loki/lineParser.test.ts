import { isLogLineJSON, isLogLineLogfmt, isLogLinePacked } from './lineParser';

describe('isLogLineJSON', () => {
  test('should return false on empty line', () => {
    expect(isLogLineJSON('')).toBe(false);
  });

  test('should return false on unknown line pattern', () => {
    expect(isLogLineJSON('To Be or not to be')).toBe(false);
  });

  test('should return false on key value patterns', () => {
    expect(isLogLineJSON('foo=bar baz="41 + 1')).toBe(false);
  });

  test('should return true on JSON log lines', () => {
    expect(isLogLineJSON('{"foo": "bar", "baz": "41 + 1"}')).toBe(true);
  });
});

describe('isLogLineLogfmt', () => {
  test('should return false on empty line', () => {
    expect(isLogLineLogfmt('')).toBe(false);
  });

  test('should return false on unknown line pattern', () => {
    expect(isLogLineLogfmt('To Be or not to be')).toBe(false);
  });

  test('should return true on key value patterns', () => {
    expect(isLogLineLogfmt('foo=bar baz="41 + 1')).toBe(true);
  });

  test('should return false on JSON log lines', () => {
    expect(isLogLineLogfmt('{"foo": "bar", "baz": "41 + 1"}')).toBe(false);
  });
});

describe('isLogLinePacked', () => {
  test('should return false on empty line', () => {
    expect(isLogLinePacked('')).toBe(false);
  });

  test('should return false on unknown line pattern', () => {
    expect(isLogLinePacked('To Be or not to be')).toBe(false);
  });

  test('should return false on key value patterns', () => {
    expect(isLogLinePacked('foo=bar baz="41 + 1')).toBe(false);
  });

  test('should return false on JSON log lines', () => {
    expect(isLogLinePacked('{"foo": "bar", "baz": "41 + 1"}')).toBe(false);
  });

  test('should return true on packed log lines', () => {
    expect(isLogLinePacked('{"foo": "bar", "_entry": "41 + 1"}')).toBe(true);
  });
});
