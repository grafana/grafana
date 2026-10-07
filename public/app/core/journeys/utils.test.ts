import { str } from './utils';

describe('str', () => {
  let warnSpy: jest.SpyInstance;
  let originalEnv: string | undefined;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    warnSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it('coerces nullish to empty string without warning', () => {
    expect(str(undefined)).toBe('');
    expect(str(null)).toBe('');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('passes through strings unchanged', () => {
    expect(str('hello')).toBe('hello');
    expect(str('')).toBe('');
  });

  it('stringifies booleans, finite numbers and bigints', () => {
    expect(str(true)).toBe('true');
    expect(str(false)).toBe('false');
    expect(str(0)).toBe('0');
    expect(str(42)).toBe('42');
    expect(str(-1.5)).toBe('-1.5');
    expect(str(BigInt(10))).toBe('10');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('coerces objects, arrays and functions to "" and warns once per type', () => {
    expect(str({ foo: 'bar' })).toBe('');
    expect(str({ baz: 1 })).toBe('');
    expect(str([1, 2, 3])).toBe('');
    expect(str(() => 0)).toBe('');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('coerces NaN and Infinity to "" instead of "NaN"/"Infinity"', () => {
    expect(str(NaN)).toBe('');
    expect(str(Infinity)).toBe('');
    expect(str(-Infinity)).toBe('');
  });

  it('does not warn in production', () => {
    process.env.NODE_ENV = 'production';
    expect(str({ foo: 'bar' })).toBe('');
    expect(str(NaN)).toBe('');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
