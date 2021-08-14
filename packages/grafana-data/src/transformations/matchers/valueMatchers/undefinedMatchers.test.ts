import { toDataFrame } from '../../../dataframe';
import { DataFrame } from '../../../types';
import { getValueMatcher } from '../../matchers';
import { ValueMatcherID } from '../ids';

describe('value undefined matcher', () => {
  const data: DataFrame[] = [
    toDataFrame({
      fields: [
        {
          name: 'temp',
          values: [7, null, undefined],
        },
      ],
    }),
  ];

  const matcher = getValueMatcher({
    id: ValueMatcherID.isUndefined,
    options: {},
  });

  it('should match undefined values', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 2;

    expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
  });

  it('should not match non-undefined values', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndexes = [0, 1];

    for (const valueIndex of valueIndexes) {
      expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
    }
  });
});

describe('value not undefined matcher', () => {
  const data: DataFrame[] = [
    toDataFrame({
      fields: [
        {
          name: 'temp',
          values: [7, null, undefined],
        },
      ],
    }),
  ];

  const matcher = getValueMatcher({
    id: ValueMatcherID.isNotUndefined,
    options: {},
  });

  it('should match non-undefined values', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndexes = [0, 1];

    for (const valueIndex of valueIndexes) {
      expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
    }
  });

  it('should not match undefined values', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 2;

    expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
  });
});
