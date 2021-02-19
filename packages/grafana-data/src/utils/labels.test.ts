import { parseLabels, formatLabels, findCommonLabels, findUniqueLabels } from './labels';

describe('parseLabels()', () => {
  it('returns no labels on empty labels string', () => {
    expect(parseLabels('')).toEqual({});
    expect(parseLabels('{}')).toEqual({});
  });

  it('returns labels on labels string', () => {
    expect(parseLabels('{foo="bar", baz="42"}')).toEqual({ foo: 'bar', baz: '42' });
  });
});

describe('formatLabels()', () => {
  it('returns no labels on empty label set', () => {
    expect(formatLabels({})).toEqual('');
    expect(formatLabels({}, 'foo')).toEqual('foo');
  });

  it('returns label string on label set', () => {
    expect(formatLabels({ foo: 'bar', baz: '42' })).toEqual('{baz="42", foo="bar"}');
  });
});

describe('findCommonLabels()', () => {
  it('returns no common labels on empty sets', () => {
    expect(findCommonLabels([{}])).toEqual({});
    expect(findCommonLabels([{}, {}])).toEqual({});
  });

  it('returns no common labels on differing sets', () => {
    expect(findCommonLabels([{ foo: 'bar' }, {}])).toEqual({});
    expect(findCommonLabels([{}, { foo: 'bar' }])).toEqual({});
    expect(findCommonLabels([{ baz: '42' }, { foo: 'bar' }])).toEqual({});
    expect(findCommonLabels([{ foo: '42', baz: 'bar' }, { foo: 'bar' }])).toEqual({});
  });

  it('returns the single labels set as common labels', () => {
    expect(findCommonLabels([{ foo: 'bar' }])).toEqual({ foo: 'bar' });
  });
});

describe('findUniqueLabels()', () => {
  it('returns no uncommon labels on empty sets', () => {
    expect(findUniqueLabels({}, {})).toEqual({});
  });

  it('returns all labels given no common labels', () => {
    expect(findUniqueLabels({ foo: '"bar"' }, {})).toEqual({ foo: '"bar"' });
  });

  it('returns all labels except the common labels', () => {
    expect(findUniqueLabels({ foo: '"bar"', baz: '"42"' }, { foo: '"bar"' })).toEqual({ baz: '"42"' });
  });
});
