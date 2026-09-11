import { executeCode, formatValue } from './executeCode';

describe('formatValue', () => {
  it('shows a string as itself, unquoted, the way a console does', () => {
    expect(formatValue('hello')).toBe('hello');
  });

  it.each([
    [42, '42'],
    [true, 'true'],
    [null, 'null'],
    [undefined, 'undefined'],
  ])('renders the primitive %s as %s', (value, expected) => {
    expect(formatValue(value)).toBe(expected);
  });

  it('pretty-prints an object as JSON', () => {
    expect(formatValue({ a: 1, b: [2, 3] })).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
  });

  it('renders a value JSON cannot serialize instead of dropping or throwing on it', () => {
    expect(formatValue(BigInt(10))).toBe('10');
    expect(formatValue({ big: BigInt(10) })).toContain('"10n"');
  });

  it('does not throw on a circular object', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => formatValue(circular)).not.toThrow();
  });

  it('renders an Error as its name and message', () => {
    expect(formatValue(new TypeError('boom'))).toBe('TypeError: boom');
  });
});

describe('executeCode', () => {
  it('returns the value of the last expression, REPL-style', async () => {
    const result = await executeCode('1 + 1');

    expect(result.value).toBe('2');
    expect(result.error).toBeUndefined();
  });

  it('evaluates statements before the trailing expression', async () => {
    const result = await executeCode('const a = 2;\nconst b = 3;\na * b');

    expect(result.value).toBe('6');
  });

  it('has no value when the cell evaluates to undefined', async () => {
    const result = await executeCode('const x = 5;');

    expect(result.value).toBeUndefined();
    expect(result.logs).toHaveLength(0);
  });

  it('captures console output in order, with its level', async () => {
    const result = await executeCode("console.log('one'); console.warn('two'); console.error('three');");

    expect(result.logs).toEqual([
      { level: 'log', text: 'one' },
      { level: 'warn', text: 'two' },
      { level: 'error', text: 'three' },
    ]);
  });

  it('formats logged objects the way it formats a result', async () => {
    const result = await executeCode("console.log('user', { id: 1 });");

    expect(result.logs[0]).toEqual({ level: 'log', text: 'user {\n  "id": 1\n}' });
  });

  it('does not leak captured logs to the real console', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await executeCode("console.log('captured, not printed');");

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('reports a runtime throw as an error rather than rejecting', async () => {
    const result = await executeCode("throw new Error('nope');");

    expect(result.error).toBe('Error: nope');
    expect(result.value).toBeUndefined();
  });

  it('reports a syntax error rather than rejecting', async () => {
    const result = await executeCode('const = ;');

    expect(result.error).toBeDefined();
    expect(result.value).toBeUndefined();
  });

  it('awaits a trailing promise so its resolved value is shown', async () => {
    const result = await executeCode('Promise.resolve(21 * 2)');

    expect(result.value).toBe('42');
  });

  it('surfaces a rejected trailing promise as an error', async () => {
    const result = await executeCode("Promise.reject(new Error('async boom'))");

    expect(result.error).toBe('Error: async boom');
  });
});
