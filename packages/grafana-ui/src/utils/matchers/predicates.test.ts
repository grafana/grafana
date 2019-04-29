import { FieldType } from '../../types/data';
import { seriesDataMatchers, SeriesDataMatcherConfig } from './matchers';
import { simpleSeriesWithTypes } from './fieldType.test';
import { SeriesDataMatcherID } from './ids';

const matchesNumberConfig: SeriesDataMatcherConfig = {
  id: SeriesDataMatcherID.fieldType,
  options: FieldType.number,
};
const matchesTimeConfig: SeriesDataMatcherConfig = {
  id: SeriesDataMatcherID.fieldType,
  options: FieldType.time,
};
const both = [matchesNumberConfig, matchesTimeConfig];

describe('Check Predicates', () => {
  it('can not match both', () => {
    const matcher = seriesDataMatchers.get(SeriesDataMatcherID.allMatch);
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matcher.matches(both, simpleSeriesWithTypes, field)).toBe(false);
    }
  });

  it('match either time or number', () => {
    const matcher = seriesDataMatchers.get(SeriesDataMatcherID.anyMatch);
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matcher.matches(both, simpleSeriesWithTypes, field)).toBe(
        field.type === FieldType.number || field.type === FieldType.time
      );
    }
  });
});
