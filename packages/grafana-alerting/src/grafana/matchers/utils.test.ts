import { LabelMatcher } from './types';
import { isLabelMatch, matchLabelsSet } from './utils';

describe('isLabelMatch', () => {
  it('should match on a set of labels with "=" operator', () => {
    const matcher: LabelMatcher = { label: 'foo', type: '=', value: 'bar' };
    const label1: [string, string] = ['foo', 'bar'];
    const label2: [string, string] = ['foo', 'baz'];

    expect(isLabelMatch(matcher, label1)).toBe(true);
    expect(isLabelMatch(matcher, label2)).toBe(false);
  });

  it('should match on a set of labels with "!=" operator', () => {
    const matcher: LabelMatcher = { label: 'foo', type: '!=', value: 'bar' };
    const label1: [string, string] = ['foo', 'baz'];
    const label2: [string, string] = ['foo', 'bar'];

    expect(isLabelMatch(matcher, label1)).toBe(true);
    expect(isLabelMatch(matcher, label2)).toBe(false);
  });

  it('should match on a set of labels with "=~" operator', () => {
    const matcher: LabelMatcher = { label: 'foo', type: '=~', value: 'ba.' };
    const label1: [string, string] = ['foo', 'baz'];
    const label2: [string, string] = ['foo', 'bar'];
    const label3: [string, string] = ['foo', 'foo'];

    expect(isLabelMatch(matcher, label1)).toBe(true);
    expect(isLabelMatch(matcher, label2)).toBe(true);
    expect(isLabelMatch(matcher, label3)).toBe(false);
  });

  it('should match on a set of labels with "!~" operator', () => {
    const matcher: LabelMatcher = { label: 'foo', type: '!~', value: 'ba.' };
    const label1: [string, string] = ['foo', 'baz'];
    const label2: [string, string] = ['foo', 'bar'];
    const label3: [string, string] = ['foo', 'foo'];

    expect(isLabelMatch(matcher, label1)).toBe(false);
    expect(isLabelMatch(matcher, label2)).toBe(false);
    expect(isLabelMatch(matcher, label3)).toBe(true);
  });
});

describe('matchLabelsSet', () => {
  it('should match if all matchers are truthy', () => {
    const matchers: LabelMatcher[] = [
      { label: 'foo', type: '=', value: 'bar' },
      { label: 'baz', type: '!=', value: 'qux' },
    ];
    const labels: Array<[string, string]> = [
      ['foo', 'bar'],
      ['baz', 'quux'],
    ];

    expect(matchLabelsSet(matchers, labels)).toBe(true);
  });

  it('should not match if a single matcher is falsy', () => {
    const matchers: LabelMatcher[] = [
      { label: 'foo', type: '=', value: 'bar' },
      { label: 'baz', type: '!=', value: 'qux' },
    ];
    const labels: Array<[string, string]> = [
      ['foo', 'baz'],
      ['baz', 'quux'],
    ];

    expect(matchLabelsSet(matchers, labels)).toBe(false);
  });

  it('should handle empty value matchers (this means the label should not appear in the set)', () => {
    const matchers: LabelMatcher[] = [
      { label: 'foo', type: '=', value: '' },
      { label: 'bar', type: '=', value: 'baz' },
    ];
    const labels: Array<[string, string]> = [['bar', 'baz']];

    expect(matchLabelsSet(matchers, labels)).toBe(true);
  });

  it('should not throw for invalid regex input', () => {
    const matchers: LabelMatcher[] = [{ label: 'foo', type: '=~', value: '(' }];
    const labels: Array<[string, string]> = [['foo', 'bar']];

    expect(() => {
      matchLabelsSet(matchers, labels);
    }).not.toThrow();

    expect(matchLabelsSet(matchers, labels)).toBe(false);
  });
});
