import { parseLabelValue, serializeLabelValue } from './labelMatcher';
import { type LabelMatcher } from './ruleSearchFilter';

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

  it('uses the earliest operator when a value contains more than one', () => {
    // "!=" precedes "=" in "a!=b=c", so it is not "a!" equal "b=c"
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
});
