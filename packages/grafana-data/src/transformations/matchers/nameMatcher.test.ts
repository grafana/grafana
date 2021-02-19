import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';

describe('Field Name Matcher', () => {
  it('Match all with wildcard regex', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byName,
      options: '/.*/',
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field)).toBe(true);
    }
  });

  it('Match all with decimals regex', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: '12' }, { name: '112' }, { name: '13' }],
    });
    const config = {
      id: FieldMatcherID.byName,
      options: '/^\\d+$/',
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field)).toBe(true);
    }
  });

  it('Match complex regex', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'some.instance.path' }, { name: '112' }, { name: '13' }],
    });
    const config = {
      id: FieldMatcherID.byName,
      options: '/\\b(?:\\S+?\\.)+\\S+\\b$/',
    };

    const matcher = getFieldMatcher(config);
    let resultCount = 0;
    for (const field of seriesWithNames.fields) {
      if (matcher(field)) {
        resultCount++;
      }
      expect(resultCount).toBe(1);
    }
  });
});
