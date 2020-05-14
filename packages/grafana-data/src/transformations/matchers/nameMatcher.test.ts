import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';

describe('Field Name by Regexp Matcher', () => {
  it('Match all with wildcard regex', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byRegexp,
      options: '/.*/',
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field, seriesWithNames, [seriesWithNames])).toBe(true);
    }
  });

  it('Match all with decimals regex', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: '12' }, { name: '112' }, { name: '13' }],
    });
    const config = {
      id: FieldMatcherID.byRegexp,
      options: '/^\\d+$/',
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field, seriesWithNames, [seriesWithNames])).toBe(true);
    }
  });

  it('Match complex regex', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'some.instance.path' }, { name: '112' }, { name: '13' }],
    });
    const config = {
      id: FieldMatcherID.byRegexp,
      options: '/\\b(?:\\S+?\\.)+\\S+\\b$/',
    };

    const matcher = getFieldMatcher(config);
    let resultCount = 0;
    for (const field of seriesWithNames.fields) {
      if (matcher(field, seriesWithNames, [seriesWithNames])) {
        resultCount++;
      }
      expect(resultCount).toBe(1);
    }
  });
});

describe('Field Name Matcher', () => {
  it('Match only exact name', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byName,
      options: 'C',
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      const didMatch = matcher(field, seriesWithNames, [seriesWithNames]);
      expect(didMatch).toBe(field.name === 'C');
    }
  });

  it('Match should respect letter case', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: '12' }, { name: '112' }, { name: '13' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byName,
      options: 'c',
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field, seriesWithNames, [seriesWithNames])).toBe(false);
    }
  });

  it('Match none of the field names', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'some.instance.path' }, { name: '112' }, { name: '13' }],
    });
    const config = {
      id: FieldMatcherID.byName,
      options: '',
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field, seriesWithNames, [seriesWithNames])).toBe(false);
    }
  });
});

describe('Field Multiple Names Matcher', () => {
  it('Match only exact name', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byNames,
      options: ['C'],
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      const didMatch = matcher(field, seriesWithNames, [seriesWithNames]);
      expect(didMatch).toBe(field.name === 'C');
    }
  });

  it('Match should respect letter case', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: '12' }, { name: '112' }, { name: '13' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byNames,
      options: ['c'],
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field, seriesWithNames, [seriesWithNames])).toBe(false);
    }
  });

  it('Match none of the field names', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'some.instance.path' }, { name: '112' }, { name: '13' }],
    });
    const config = {
      id: FieldMatcherID.byNames,
      options: [],
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field, seriesWithNames, [seriesWithNames])).toBe(false);
    }
  });

  it('Match all of the field names', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'some.instance.path' }, { name: '112' }, { name: '13' }],
    });
    const config = {
      id: FieldMatcherID.byNames,
      options: ['some.instance.path', '112', '13'],
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field, seriesWithNames, [seriesWithNames])).toBe(true);
    }
  });
});

describe('Field Regexp or Names Matcher', () => {
  it('Match only exact name by name', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byRegexpOrNames,
      options: {
        names: ['C'],
      },
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      const didMatch = matcher(field, seriesWithNames, [seriesWithNames]);
      expect(didMatch).toBe(field.name === 'C');
    }
  });

  it('Match all starting with AA', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byRegexpOrNames,
      options: {
        pattern: '/^AA/',
      },
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      const didMatch = matcher(field, seriesWithNames, [seriesWithNames]);
      expect(didMatch).toBe(field.name === 'AAA');
    }
  });

  it('Match all starting with AA and C', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byRegexpOrNames,
      options: {
        pattern: '/^AA/',
        names: ['C'],
      },
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      const didMatch = matcher(field, seriesWithNames, [seriesWithNames]);
      expect(didMatch).toBe(field.name === 'AAA' || field.name === 'C');
    }
  });

  it('Match should respect letter case by name if not igored in pattern', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: '12' }, { name: '112' }, { name: '13' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byRegexpOrNames,
      options: {
        names: ['c'],
        pattern: '/c/i',
      },
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      const didMatch = matcher(field, seriesWithNames, [seriesWithNames]);
      expect(didMatch).toBe(field.name === 'C');
    }
  });

  it('Match none of the field names by name', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'some.instance.path' }, { name: '112' }, { name: '13' }],
    });
    const config = {
      id: FieldMatcherID.byRegexpOrNames,
      options: {
        names: [],
      },
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field, seriesWithNames, [seriesWithNames])).toBe(false);
    }
  });

  it('Match all of the field names by name', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'some.instance.path' }, { name: '112' }, { name: '13' }],
    });
    const config = {
      id: FieldMatcherID.byRegexpOrNames,
      options: {
        names: ['some.instance.path', '112', '13'],
      },
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field, seriesWithNames, [seriesWithNames])).toBe(true);
    }
  });

  it('Match all of the field names by regexp', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'some.instance.path' }, { name: '112' }, { name: '13' }],
    });
    const config = {
      id: FieldMatcherID.byRegexpOrNames,
      options: {
        pattern: '/.*/',
      },
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field, seriesWithNames, [seriesWithNames])).toBe(true);
    }
  });
});
