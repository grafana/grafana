import { toDataFrame } from '../../dataframe/processDataFrame';
import { BootData } from '../../types/config';
import { DataFrame, FieldType } from '../../types/dataFrame';
import { getFieldMatcher } from '../matchers';

import { FieldMatcherID } from './ids';
import { ByNamesMatcherMode } from './nameMatcher';

window.grafanaBootData = {
  settings: {
    featureToggles: {
      dataplaneFrontendFallback: true,
    },
  },
} as BootData;

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

  it('Match name or displayName', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'a', config: { displayName: 'LongerName' } }],
    });
    const field = seriesWithNames.fields[0];
    expect(
      getFieldMatcher({
        id: FieldMatcherID.byName,
        options: 'c',
      })(field, seriesWithNames, [seriesWithNames])
    ).toBe(false); // No match

    expect(
      getFieldMatcher({
        id: FieldMatcherID.byName,
        options: 'a',
      })(field, seriesWithNames, [seriesWithNames])
    ).toBe(true);

    expect(
      getFieldMatcher({
        id: FieldMatcherID.byName,
        options: 'LongerName',
      })(field, seriesWithNames, [seriesWithNames])
    ).toBe(true);
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
      options: {
        mode: ByNamesMatcherMode.include,
        names: ['C'],
      },
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      const didMatch = matcher(field, seriesWithNames, [seriesWithNames]);
      expect(didMatch).toBe(field.name === 'C');
    }
  });

  it('Match should default to include mode', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byNames,
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

  it('Match should respect letter case', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: '12' }, { name: '112' }, { name: '13' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byNames,
      options: {
        mode: ByNamesMatcherMode.include,
        names: ['c'],
      },
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
      options: {
        mode: ByNamesMatcherMode.include,
        names: [],
      },
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
      options: {
        mode: ByNamesMatcherMode.include,
        names: ['some.instance.path', '112', '13'],
      },
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      expect(matcher(field, seriesWithNames, [seriesWithNames])).toBe(true);
    }
  });

  it('Match all but supplied names', () => {
    const seriesWithNames = toDataFrame({
      fields: [{ name: 'A hello world' }, { name: 'AAA' }, { name: 'C' }],
    });
    const config = {
      id: FieldMatcherID.byNames,
      options: {
        mode: ByNamesMatcherMode.exclude,
        names: ['C'],
      },
    };

    const matcher = getFieldMatcher(config);

    for (const field of seriesWithNames.fields) {
      const didMatch = matcher(field, seriesWithNames, [seriesWithNames]);
      expect(didMatch).toBe(field.name !== 'C');
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

  it('Support fallback name matchers', () => {
    const frame: DataFrame = {
      fields: [
        { name: 'time', type: FieldType.time, config: {}, values: [1, 2] },
        {
          name: 'UP',
          type: FieldType.number,
          config: {},
          values: [1, 2],
          labels: { __name__: 'UP' },
        },
      ],
      name: 'X',
      length: 2,
    };

    let matcher = getFieldMatcher({
      id: FieldMatcherID.byName,
      options: 'Value',
    });
    expect(matcher(frame.fields[0], frame, [])).toBeFalsy();
    expect(matcher(frame.fields[1], frame, [])).toBeTruthy();

    matcher = getFieldMatcher({
      id: FieldMatcherID.byName,
      options: 'Time',
    });
    expect(matcher(frame.fields[0], frame, [])).toBeTruthy();
    expect(matcher(frame.fields[1], frame, [])).toBeFalsy();
  });
});

it('Support fallback multiple names matchers', () => {
  const frame: DataFrame = {
    fields: [
      { name: 'time', type: FieldType.time, config: {}, values: [1, 2] },
      {
        name: 'UP',
        type: FieldType.number,
        config: {},
        values: [1, 2],
        labels: { __name__: 'UP' },
      },
    ],
    name: 'X',
    length: 2,
  };

  let matcher = getFieldMatcher({
    id: FieldMatcherID.byNames,
    options: {
      mode: ByNamesMatcherMode.include,
      names: ['Value'],
    },
  });
  expect(matcher(frame.fields[0], frame, [])).toBeFalsy();
  expect(matcher(frame.fields[1], frame, [])).toBeTruthy();

  matcher = getFieldMatcher({
    id: FieldMatcherID.byNames,
    options: {
      mode: ByNamesMatcherMode.include,
      names: ['Time'],
    },
  });
  expect(matcher(frame.fields[0], frame, [])).toBeTruthy();
  expect(matcher(frame.fields[1], frame, [])).toBeFalsy();
});

describe('Fields returned by query with refId', () => {
  it('Match all fields in frame with refId: A', () => {
    const data = [
      toDataFrame({
        refId: 'A',
        fields: [{ name: 'field_1' }, { name: 'field_2' }],
      }),
      toDataFrame({
        refId: 'B',
        fields: [{ name: 'field_1' }, { name: 'field_2' }],
      }),
    ];

    const matcher = getFieldMatcher({
      id: FieldMatcherID.byFrameRefID,
      options: 'A',
    });

    const frameA = data[0];
    expect(matcher(frameA.fields[0], frameA, data)).toBe(true);
    expect(matcher(frameA.fields[1], frameA, data)).toBe(true);

    const frameB = data[1];
    expect(matcher(frameB.fields[0], frameB, data)).toBe(false);
    expect(matcher(frameB.fields[1], frameB, data)).toBe(false);
  });
});
