import { type LabelMatcher } from './criteria';
import { parseLabelValue, serializeLabelValue } from './labelMatcher';

describe('parseLabelValue', () => {
  it.each<[string, LabelMatcher | undefined]>([
    ['team', { key: 'team', operator: 'exists' }],
    ['!team', { key: 'team', operator: 'absent' }],
    ['team=api', { key: 'team', operator: 'equal', value: 'api' }],
    ['team!=api', { key: 'team', operator: 'notEqual', value: 'api' }],
    ['team=~api.*', { key: 'team', operator: 'regex', value: 'api.*' }],
    ['team!~api.*', { key: 'team', operator: 'notRegex', value: 'api.*' }],
    ['team=', { key: 'team', operator: 'equal', value: '' }],
    ['', undefined],
    ['!', undefined],
    ['=api', undefined],
  ])('parses %s', (raw, expected) => {
    expect(parseLabelValue(raw)).toEqual(expected);
  });

  it('SEARCH-3: uses the earliest operator when a value contains more than one', () => {
    // "!=" occurs before "=" in "a!=b=c", so it must not be mistaken for "a!" equal "b=c"
    expect(parseLabelValue('a!=b=c')).toEqual({ key: 'a', operator: 'notEqual', value: 'b=c' });
  });
});

describe('serializeLabelValue', () => {
  it.each<[LabelMatcher, string]>([
    [{ key: 'team', operator: 'exists' }, 'team'],
    [{ key: 'team', operator: 'absent' }, '!team'],
    [{ key: 'team', operator: 'equal', value: 'api' }, 'team=api'],
    [{ key: 'team', operator: 'notEqual', value: 'api' }, 'team!=api'],
    [{ key: 'team', operator: 'regex', value: 'api.*' }, 'team=~api.*'],
    [{ key: 'team', operator: 'notRegex', value: 'api.*' }, 'team!~api.*'],
  ])('serializes %o to %s', (matcher, expected) => {
    expect(serializeLabelValue(matcher)).toBe(expected);
  });

  it('round-trips every operator through parse and serialize', () => {
    const matchers: LabelMatcher[] = [
      { key: 'team', operator: 'exists' },
      { key: 'team', operator: 'absent' },
      { key: 'team', operator: 'equal', value: 'api' },
      { key: 'team', operator: 'notEqual', value: 'api' },
      { key: 'team', operator: 'regex', value: 'api.*' },
      { key: 'team', operator: 'notRegex', value: 'api.*' },
    ];

    for (const matcher of matchers) {
      expect(parseLabelValue(serializeLabelValue(matcher))).toEqual(matcher);
    }
  });
});
