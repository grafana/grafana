import { toDataFrame } from '../../../dataframe';
import { DataFrame } from '../../../types/dataFrame';
import { getValueMatcher } from '../../matchers';
import { ValueMatcherID } from '../ids';

describe('value equals to matcher', () => {
  const data: DataFrame[] = [
    toDataFrame({
      fields: [
        {
          name: 'temp',
          values: [23, null, 10, 'asd', '23'],
        },
      ],
    }),
  ];

  const matcher = getValueMatcher({
    id: ValueMatcherID.equal,
    options: {
      value: 23,
    },
  });

  it('should match when option value is same', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 0;

    expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
  });

  it('should not match when option value is different', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 2;

    expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
  });

  it('should not match when option value is different type', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 3;

    expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
  });

  it('should match when option value is different type but same', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 4;

    expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
  });
});

describe('value not equals matcher', () => {
  const data: DataFrame[] = [
    toDataFrame({
      fields: [
        {
          name: 'temp',
          values: [23, null, 10, 'asd', '23'],
        },
      ],
    }),
  ];

  const matcher = getValueMatcher({
    id: ValueMatcherID.notEqual,
    options: {
      value: 23,
    },
  });

  it('should not match when option value is same', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 0;

    expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
  });

  it('should match when option value is different', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 2;

    expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
  });

  it('should match when option value is different type', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 3;

    expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
  });

  it('should not match when option value is different type but same', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 4;

    expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
  });
});
