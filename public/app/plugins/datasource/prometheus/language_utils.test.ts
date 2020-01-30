import { expandRecordingRules, parseSelector } from './language_utils';

describe('parseSelector()', () => {
  let parsed;

  it('returns a clean selector from an empty selector', () => {
    parsed = parseSelector('{}', 1);
    expect(parsed.selector).toBe('{}');
    expect(parsed.labelKeys).toEqual([]);
  });

  it('throws if selector is broken', () => {
    expect(() => parseSelector('{foo')).toThrow();
  });

  it('returns the selector sorted by label key', () => {
    parsed = parseSelector('{foo="bar"}');
    expect(parsed.selector).toBe('{foo="bar"}');
    expect(parsed.labelKeys).toEqual(['foo']);

    parsed = parseSelector('{foo="bar",baz="xx"}');
    expect(parsed.selector).toBe('{baz="xx",foo="bar"}');
  });

  it('returns a clean selector from an incomplete one', () => {
    parsed = parseSelector('{foo}');
    expect(parsed.selector).toBe('{}');

    parsed = parseSelector('{foo="bar",baz}');
    expect(parsed.selector).toBe('{foo="bar"}');

    parsed = parseSelector('{foo="bar",baz="}');
    expect(parsed.selector).toBe('{foo="bar"}');

    // Cursor in value area counts as incomplete
    parsed = parseSelector('{foo="bar",baz=""}', 16);
    expect(parsed.selector).toBe('{foo="bar"}');

    parsed = parseSelector('{foo="bar",baz="4"}', 17);
    expect(parsed.selector).toBe('{foo="bar"}');
  });

  it('throws if not inside a selector', () => {
    expect(() => parseSelector('foo{}', 0)).toThrow();
    expect(() => parseSelector('foo{} + bar{}', 5)).toThrow();
  });

  it('returns the selector nearest to the cursor offset', () => {
    expect(() => parseSelector('{foo="bar"} + {foo="bar"}', 0)).toThrow();

    parsed = parseSelector('{foo="bar"} + {foo="bar"}', 1);
    expect(parsed.selector).toBe('{foo="bar"}');

    parsed = parseSelector('{foo="bar"} + {baz="xx"}', 1);
    expect(parsed.selector).toBe('{foo="bar"}');

    parsed = parseSelector('{baz="xx"} + {foo="bar"}', 16);
    expect(parsed.selector).toBe('{foo="bar"}');
  });

  it('returns a selector with metric if metric is given', () => {
    parsed = parseSelector('bar{foo}', 4);
    expect(parsed.selector).toBe('{__name__="bar"}');

    parsed = parseSelector('baz{foo="bar"}', 13);
    expect(parsed.selector).toBe('{__name__="baz",foo="bar"}');

    parsed = parseSelector('bar:metric:1m{}', 14);
    expect(parsed.selector).toBe('{__name__="bar:metric:1m"}');
  });
});

describe('expandRecordingRules()', () => {
  it('returns query w/o recording rules as is', () => {
    expect(expandRecordingRules('metric', {})).toBe('metric');
    expect(expandRecordingRules('metric + metric', {})).toBe('metric + metric');
    expect(expandRecordingRules('metric{}', {})).toBe('metric{}');
  });

  it('does not modify recording rules name in label values', () => {
    expect(expandRecordingRules('{__name__="metric"} + bar', { metric: 'foo', bar: 'super' })).toBe(
      '{__name__="metric"} + super'
    );
  });

  it('returns query with expanded recording rules', () => {
    expect(expandRecordingRules('metric', { metric: 'foo' })).toBe('foo');
    expect(expandRecordingRules('metric + metric', { metric: 'foo' })).toBe('foo + foo');
    expect(expandRecordingRules('metric{}', { metric: 'foo' })).toBe('foo{}');
    expect(expandRecordingRules('metric[]', { metric: 'foo' })).toBe('foo[]');
    expect(expandRecordingRules('metric + foo', { metric: 'foo', foo: 'bar' })).toBe('foo + bar');
  });
});
