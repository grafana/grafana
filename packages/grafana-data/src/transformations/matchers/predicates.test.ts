import { FieldType } from '../../types/dataFrame';
import { MatcherConfig } from '../../types/transformations';
import { fieldMatchers } from '../matchers';

import { FieldMatcherID, MatcherID } from './ids';
import { simpleSeriesWithTypes } from './mocks';

const matchesNumberConfig: MatcherConfig = {
  id: FieldMatcherID.byType,
  options: FieldType.number,
};
const matchesTimeConfig: MatcherConfig = {
  id: FieldMatcherID.byType,
  options: FieldType.time,
};
const both = [matchesNumberConfig, matchesTimeConfig];
const allFrames = [simpleSeriesWithTypes];

describe('Check Predicates', () => {
  it('can not match both', () => {
    const matches = fieldMatchers.get(MatcherID.allMatch).get(both);
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matches(field, simpleSeriesWithTypes, allFrames)).toBe(false);
    }
  });

  it('match either time or number', () => {
    const matches = fieldMatchers.get(MatcherID.anyMatch).get(both);
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matches(field, simpleSeriesWithTypes, allFrames)).toBe(
        field.type === FieldType.number || field.type === FieldType.time
      );
    }
  });

  it('match not time', () => {
    const matches = fieldMatchers.get(MatcherID.invertMatch).get(matchesTimeConfig);
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matches(field, simpleSeriesWithTypes, allFrames)).toBe(field.type !== FieldType.time);
    }
  });
});
