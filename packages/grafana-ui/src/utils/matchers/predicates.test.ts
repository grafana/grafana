import { FieldType } from '../../types/data';
import { seriesMatchers, SeriesMatcherConfig } from './matchers';
import { simpleSeriesWithTypes } from './typeMatcher.test';
import { SeriesMatcherID } from './ids';

const matchesNumberConfig: SeriesMatcherConfig = {
  id: SeriesMatcherID.fieldType,
  options: FieldType.number,
};
const matchesTimeConfig: SeriesMatcherConfig = {
  id: SeriesMatcherID.fieldType,
  options: FieldType.time,
};
const both = [matchesNumberConfig, matchesTimeConfig];

describe('Check Predicates', () => {
  it('can not match both', () => {
    const matcher = seriesMatchers.get(SeriesMatcherID.allMatch);
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matcher.matcher(both)(simpleSeriesWithTypes, field)).toBe(false);
    }
  });

  it('match either time or number', () => {
    const matcher = seriesMatchers.get(SeriesMatcherID.anyMatch);
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matcher.matcher(both)(simpleSeriesWithTypes, field)).toBe(
        field.type === FieldType.number || field.type === FieldType.time
      );
    }
  });
});
