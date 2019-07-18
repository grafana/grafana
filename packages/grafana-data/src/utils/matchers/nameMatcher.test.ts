import { getDataMatcher } from './matchers';
import { DataMatcherID } from './ids';

const seriesWithNames = {
  fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
  rows: [],
};

describe('Field Type Matcher', () => {
  it('Match all with wildcard regex', () => {
    const config = {
      id: DataMatcherID.fieldName,
      options: '/.*/',
    };

    const matcher = getDataMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(seriesWithNames, field)).toBe(true);
    }
  });
});
