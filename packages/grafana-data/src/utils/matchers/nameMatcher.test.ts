import { getDataMatcher } from './matchers';
import { DataMatcherID } from './ids';
import { toDataFrame } from '../processDataFrame';

const seriesWithNames = toDataFrame({
  fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
});

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
