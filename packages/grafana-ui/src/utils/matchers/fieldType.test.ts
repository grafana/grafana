import { FieldType } from '../../types/data';
import { SeriesDataMatcherID } from './ids';
import { seriesDataMatchers } from './matchers';

export const simpleSeriesWithTypes = {
  fields: [
    { name: 'A', type: FieldType.time },
    { name: 'B', type: FieldType.boolean },
    { name: 'C', type: FieldType.string },
  ],
  rows: [],
};

describe('Field Type Matcher', () => {
  const matcher = seriesDataMatchers.get(SeriesDataMatcherID.fieldType);
  it('finds numbers', () => {
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matcher.matches(FieldType.number, simpleSeriesWithTypes, field)).toBe(field.type === FieldType.number);
    }
  });
});
