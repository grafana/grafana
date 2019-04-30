import { getSeriesMatcher } from './matchers';
import { SeriesMatcherID } from './ids';

const seriesWithNames = {
  fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
  rows: [],
};

describe('Field Type Matcher', () => {
  it('Match all with wildcard regex', () => {
    const config = {
      id: SeriesMatcherID.fieldName,
      options: '/.*/',
    };

    const matcher = getSeriesMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(seriesWithNames, field)).toBe(true);
    }
  });
});
