import { FieldType } from '../../types/dataFrame';
import { dataMatchers, DataMatcherConfig } from './matchers';
import { simpleSeriesWithTypes } from './typeMatcher.test';
import { DataMatcherID } from './ids';

const matchesNumberConfig: DataMatcherConfig = {
  id: DataMatcherID.fieldType,
  options: FieldType.number,
};
const matchesTimeConfig: DataMatcherConfig = {
  id: DataMatcherID.fieldType,
  options: FieldType.time,
};
const both = [matchesNumberConfig, matchesTimeConfig];

describe('Check Predicates', () => {
  it('can not match both', () => {
    const matcher = dataMatchers.get(DataMatcherID.allMatch);
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matcher.matcher(both)(simpleSeriesWithTypes, field)).toBe(false);
    }
  });

  it('match either time or number', () => {
    const matcher = dataMatchers.get(DataMatcherID.anyMatch);
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matcher.matcher(both)(simpleSeriesWithTypes, field)).toBe(
        field.type === FieldType.number || field.type === FieldType.time
      );
    }
  });
});
