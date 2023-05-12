import { isISONanoString, toISONanoString, fromISONanoString } from './nano';

import { dateTime, ISO_8601 } from '.';

describe('isISONanoString', () => {
  it('should reject invalid strings', () => {
    expect(isISONanoString('')).toBe(false);
    expect(isISONanoString('haha')).toBe(false);
    expect(isISONanoString('now')).toBe(false);
    expect(isISONanoString('now-2h')).toBe(false);
  });

  it('should accept valid strings without a nanosecond part', () => {
    expect(isISONanoString('2023-06-14T07:49:50.123Z')).toBe(true);
    expect(isISONanoString('+232023-06-14T07:49:50.123Z')).toBe(true);
    expect(isISONanoString('-232023-06-14T07:49:50.123Z')).toBe(true);
  });
  it('should accept valid strings with a nanosecond part', () => {
    expect(isISONanoString('2023-06-14T07:49:50.123456789Z')).toBe(true);
    expect(isISONanoString('+232023-06-14T07:49:50.123456789Z')).toBe(true);
    expect(isISONanoString('-232023-06-14T07:49:50.123456789Z')).toBe(true);

    expect(isISONanoString('2023-06-14T07:49:50.123000018Z')).toBe(true);
    expect(isISONanoString('+232023-06-14T07:49:50.123000018Z')).toBe(true);
    expect(isISONanoString('-232023-06-14T07:49:50.123000018Z')).toBe(true);
  });
});

describe('toISONanoString', () => {
  const test = (msText: string, nano: number, expected: string) =>
    expect(toISONanoString(dateTime(msText, ISO_8601), nano)).toBe(expected);
  it('should work with nanoseconds', () => {
    test('2023-06-14T07:49:50.123Z', 456789, '2023-06-14T07:49:50.123456789Z');
    test('+232023-06-14T07:49:50.123Z', 456789, '+232023-06-14T07:49:50.123456789Z');
    test('-232023-06-14T07:49:50.123Z', 456789, '-232023-06-14T07:49:50.123456789Z');
  });

  it('should work with small nanosecond numbers', () => {
    test('2023-06-14T07:49:50.123Z', 18, '2023-06-14T07:49:50.123000018Z');
    test('+232023-06-14T07:49:50.123Z', 18, '+232023-06-14T07:49:50.123000018Z');
    test('-232023-06-14T07:49:50.123Z', 18, '-232023-06-14T07:49:50.123000018Z');
  });

  it('should work without nanoseconds', () => {
    test('2023-06-14T07:49:50.123Z', 0, '2023-06-14T07:49:50.123Z');
    test('+232023-06-14T07:49:50.123Z', 0, '+232023-06-14T07:49:50.123Z');
    test('-232023-06-14T07:49:50.123Z', 0, '-232023-06-14T07:49:50.123Z');
  });
});

describe('fromISONanoString', () => {
  const test = (text: string, expectedMsText: string, expectedNano: number) => {
    const output = fromISONanoString(text);
    expect(output).not.toBeNull();
    if (output == null) {
      // need to make typescript happy
      throw new Error('should not happen');
    }
    expect(output[0].toISOString()).toBe(expectedMsText);
    expect(output[1]).toBe(expectedNano);
  };

  it('should reject invalid strings', () => {
    expect(fromISONanoString('haha')).toBeNull();
  });

  it('should work with nanoseconds', () => {
    test('2023-06-14T07:49:50.123456789Z', '2023-06-14T07:49:50.123Z', 456789);
    test('+232023-06-14T07:49:50.123456789Z', '+232023-06-14T07:49:50.123Z', 456789);
    test('-232023-06-14T07:49:50.123456789Z', '-232023-06-14T07:49:50.123Z', 456789);
  });

  it('should work with small nanosecond numbers', () => {
    test('2023-06-14T07:49:50.123000018Z', '2023-06-14T07:49:50.123Z', 18);
    test('+232023-06-14T07:49:50.123000018Z', '+232023-06-14T07:49:50.123Z', 18);
    test('-232023-06-14T07:49:50.123000018Z', '-232023-06-14T07:49:50.123Z', 18);
  });

  it('should work without nanoseconds', () => {
    test('2023-06-14T07:49:50.123Z', '2023-06-14T07:49:50.123Z', 0);
    test('+232023-06-14T07:49:50.123Z', '+232023-06-14T07:49:50.123Z', 0);
    test('-232023-06-14T07:49:50.123Z', '-232023-06-14T07:49:50.123Z', 0);
  });
});
