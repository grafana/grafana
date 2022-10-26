import { toDataFrame } from '../../dataframe/processDataFrame';
import { getFieldMatcher, getValueMatcher } from '../matchers';

import { FieldMatcherID, ValueMatcherID } from './ids';

describe('Field by values', () => {
  it('Matches field with only zero values', () => {
    const series = toDataFrame({
      fields: [{ name: 'zero', values: [0, 0, 0] }],
    });

    const valueMatcherConfig = {
      id: ValueMatcherID.equal,
      options: {
        value: 0,
      },
    };

    const config = {
      id: FieldMatcherID.allValues,
      options: {
        valueMatcherConfig: valueMatcherConfig,
      },
    };

    const matcher = getFieldMatcher(config);

    expect(matcher(series.fields[0], series, [series])).toBe(true);
  });

  it('Does not match field with other values than zero', () => {
    const series = toDataFrame({
      fields: [{ name: 'one', values: [1, 0, 0] }],
    });

    const valueMatcherConfig = {
      id: ValueMatcherID.equal,
      options: {
        value: 0,
      },
    };

    const config = {
      id: FieldMatcherID.allValues,
      options: {
        valueMatcherConfig: valueMatcherConfig,
      },
    };

    const matcher = getFieldMatcher(config);

    expect(matcher(series.fields[0], series, [series])).toBe(false);
  });

  it('Matches field with only null values', () => {
    const series = toDataFrame({
      fields: [{ name: 'null', values: [null, null, null] }],
    });

    const valueMatcherConfig = {
      id: ValueMatcherID.isNull,
    };

    const config = {
      id: FieldMatcherID.allValues,
      options: {
        valueMatcherConfig: valueMatcherConfig,
      },
    };

    const matcher = getFieldMatcher(config);

    expect(matcher(series.fields[0], series, [series])).toBe(true);
  });
});
