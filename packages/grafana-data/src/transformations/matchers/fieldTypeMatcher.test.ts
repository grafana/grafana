import { FieldType } from '../../types/dataFrame';
import { fieldMatchers } from '../matchers';

import { FieldMatcherID } from './ids';
import { simpleSeriesWithTypes } from './mocks';

describe('Field Type Matcher', () => {
  const matcher = fieldMatchers.get(FieldMatcherID.byType);
  it('finds numbers', () => {
    for (const field of simpleSeriesWithTypes.fields) {
      const matches = matcher.get(FieldType.number);
      const didMatch = matches(field, simpleSeriesWithTypes, [simpleSeriesWithTypes]);
      expect(didMatch).toBe(field.type === FieldType.number);
    }
  });
});
