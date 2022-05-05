import { toDataFrame } from '../../../dataframe';
import { DataFrame } from '../../../types/dataFrame';
import { getValueMatcher } from '../../matchers';
import { ValueMatcherID } from '../ids';

describe('value between matcher', () => {
  const data: DataFrame[] = [
    toDataFrame({
      fields: [
        {
          name: 'temp',
          values: [23, 11, 10, 25],
        },
      ],
    }),
  ];

  const matcher = getValueMatcher({
    id: ValueMatcherID.between,
    options: {
      from: 10,
      to: 25,
    },
  });

  it('should match values greater than 10 but lower than 25', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 0;

    expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
  });

  it('should not match values greater than 25', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 4;

    expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
  });

  it('should not match values lower than 11', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 2;

    expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
  });
});
