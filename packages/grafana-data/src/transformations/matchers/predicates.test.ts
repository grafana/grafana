import { FieldType } from '../../types/dataFrame';
import { fieldMatchers } from '../matchers';
import { simpleSeriesWithTypes } from './fieldTypeMatcher.test';
import { FieldMatcherID, MatcherID } from './ids';
import { MatcherConfig } from '../../types/transformations';

const matchesNumberConfig: MatcherConfig = {
  id: FieldMatcherID.byType,
  options: FieldType.number,
};
const matchesTimeConfig: MatcherConfig = {
  id: FieldMatcherID.byType,
  options: FieldType.time,
};
const both = [matchesNumberConfig, matchesTimeConfig];

describe('Check Predicates', () => {
  it('can not match both', () => {
    const matches = fieldMatchers.get(MatcherID.allMatch).get(both);
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matches(field)).toBe(false);
    }
  });

  it('match either time or number', () => {
    const matches = fieldMatchers.get(MatcherID.anyMatch).get(both);
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matches(field)).toBe(field.type === FieldType.number || field.type === FieldType.time);
    }
  });

  it('match not time', () => {
    const matches = fieldMatchers.get(MatcherID.invertMatch).get(matchesTimeConfig);
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matches(field)).toBe(field.type !== FieldType.time);
    }
  });
});
