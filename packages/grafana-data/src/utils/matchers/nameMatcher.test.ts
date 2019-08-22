import { getDataMatcher } from './matchers';
import { DataMatcherID } from './ids';
import { toDataFrame } from '../processDataFrame';

describe('Field Name Matcher', () => {
  it('Match all with wildcard regex', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
    });
    const config = {
      id: DataMatcherID.fieldName,
      options: '/.*/',
    };

    const matcher = getDataMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(seriesWithNames, field)).toBe(true);
    }
  });

  it('Match all with decimals regex', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: '12' }, { name: '112' }, { name: '13' }],
    });
    const config = {
      id: DataMatcherID.fieldName,
      options: '/^\\d+$/',
    };

    const matcher = getDataMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(seriesWithNames, field)).toBe(true);
    }
  });

  it('Match complex regex', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'some.instance.path' }, { name: '112' }, { name: '13' }],
    });
    const config = {
      id: DataMatcherID.fieldName,
      options: '/\\b(?:\\S+?\\.)+\\S+\\b$/',
    };

    const matcher = getDataMatcher(config);
    let resultCount = 0;
    for (const field of seriesWithNames.fields) {
      if (matcher(seriesWithNames, field)) {
        resultCount++;
      }
      expect(resultCount).toBe(1);
    }
  });
});
