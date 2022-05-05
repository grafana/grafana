import { toDataFrame } from '../../../dataframe';
import { DataFrame } from '../../../types/dataFrame';
import { getValueMatcher } from '../../matchers';
import { ValueMatcherID } from '../ids';

describe('value null matcher', () => {
  const data: DataFrame[] = [
    toDataFrame({
      fields: [
        {
          name: 'temp',
          values: [23, null, 10, undefined],
        },
      ],
    }),
  ];

  const matcher = getValueMatcher({
    id: ValueMatcherID.isNull,
    options: {},
  });

  it('should match null values', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 1;

    expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
  });

  it('should not match non-null values', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 0;

    expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
  });

  it('should match undefined values', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 3;

    expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
  });
});

describe('value not null matcher', () => {
  const data: DataFrame[] = [
    toDataFrame({
      fields: [
        {
          name: 'temp',
          values: [23, null, 10, undefined],
        },
      ],
    }),
  ];

  const matcher = getValueMatcher({
    id: ValueMatcherID.isNotNull,
    options: {},
  });

  it('should match not null values', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 0;

    expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
  });

  it('should not match null values', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 1;

    expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
  });

  it('should not match undefined values', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 3;

    expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
  });
});
