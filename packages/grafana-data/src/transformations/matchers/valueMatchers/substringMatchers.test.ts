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

  // Added for https://github.com/grafana/grafana/pull/83548#pullrequestreview-1904931540 where the matcher was not handling null values
  it('should be a mismatch if the option is null and should not cause errors', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 1;

    expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
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
          values: ['24', null, '050', 'asd', '42', '0'],
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

  it('should not match if the value is "0" and the option value is "0"', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 5;

    const zeroMatcher = getValueMatcher({
      id: ValueMatcherID.notSubstring,
      options: {
        value: '0',
      },
    });

    expect(zeroMatcher(valueIndex, field, frame, data)).toBeFalsy();
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

  it('it should not match if the option value is empty string', () => {
    const frame = data[0];
    const field = frame.fields[0];
    const valueIndex = 0;
    const emptyMatcher = getValueMatcher({
      id: ValueMatcherID.notSubstring,
      options: {
        value: '',
      },
    });

    expect(emptyMatcher(valueIndex, field, frame, data)).toBeFalsy();
  });
});
