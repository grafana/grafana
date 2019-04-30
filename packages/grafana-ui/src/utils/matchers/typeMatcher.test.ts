import { FieldType } from '../../types/data';
import { seriesMatchers } from './matchers';
import { SeriesMatcherID } from './ids';

export const simpleSeriesWithTypes = {
  fields: [
    { name: 'A', type: FieldType.time },
    { name: 'B', type: FieldType.boolean },
    { name: 'C', type: FieldType.string },
  ],
  rows: [],
};

describe('Field Type Matcher', () => {
  const matcher = seriesMatchers.get(SeriesMatcherID.fieldType);
  it('finds numbers', () => {
    for (const field of simpleSeriesWithTypes.fields) {
      expect(matcher.matcher(FieldType.number)(simpleSeriesWithTypes, field)).toBe(field.type === FieldType.number);
    }
  });
});
