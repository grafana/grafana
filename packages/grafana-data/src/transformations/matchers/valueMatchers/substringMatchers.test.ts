import { toDataFrame } from '../../../dataframe';
import { DataFrame } from '../../../types/dataFrame';
import { getValueMatcher } from '../../matchers';
import { ValueMatcherID } from '../ids';

describe('value substring to matcher', () => {
  const data: DataFrame[] = [
    toDataFrame({
      fields: [
        {
          name: 'temp',
          values: ['24', null, '10', 'asd', '42'],
        },
      ],
    }),
  ];

  const matcher = getValueMatcher({
    id: ValueMatcherID.substring,
    options: {
      value: '2',
    },
  });

  it('should match when option value is a substring', () => {
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

  it('should match when option value is a substring', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 4;

    expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
  });
});

describe('value not substring matcher', () => {
  const data: DataFrame[] = [
    toDataFrame({
      fields: [
        {
          name: 'temp',
          values: ['24', null, '050', 'asd', '42'],
        },
      ],
    }),
  ];

  const matcher = getValueMatcher({
    id: ValueMatcherID.notSubstring,
    options: {
      value: '5',
    },
  });

  it('should match when option value is a substring', () => {
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

  it('should match when value is null because null its not a substring', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 4;

    expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
  });
});
