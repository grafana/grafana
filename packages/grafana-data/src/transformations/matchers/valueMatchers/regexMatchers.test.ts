import { toDataFrame } from '../../../dataframe';
import { DataFrame } from '../../../types/dataFrame';
import { getValueMatcher } from '../../matchers';
import { ValueMatcherID } from '../ids';

describe('regex value matcher', () => {
  const data: DataFrame[] = [
    toDataFrame({
      fields: [
        {
          name: 'temp',
          values: ['.', 'asdf', 100, '25.5'],
        },
      ],
    }),
  ];

  describe('option with value .*', () => {
    const matcher = getValueMatcher({
      id: ValueMatcherID.regex,
      options: {
        value: '.*',
      },
    });

    it('should match all values', () => {
      const frame = data[0];
      const field = frame.fields[0];

      for (let i = 0; i < field.values.length; i++) {
        expect(matcher(i, field, frame, data)).toBeTruthy();
      }
    });
  });

  describe('option with value \\w+', () => {
    const matcher = getValueMatcher({
      id: ValueMatcherID.regex,
      options: {
        value: '\\w+',
      },
    });

    it('should match wordy values', () => {
      const frame = data[0];
      const field = frame.fields[0];
      const valueIndex = 1;

      expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
    });

    it('should not match non-wordy values', () => {
      const frame = data[0];
      const field = frame.fields[0];
      const valueIndex = 0;

      expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
    });
  });

  describe('option with value \\d+', () => {
    const matcher = getValueMatcher({
      id: ValueMatcherID.regex,
      options: {
        value: '\\d+',
      },
    });

    it('should match numeric values', () => {
      const frame = data[0];
      const field = frame.fields[0];
      const valueIndex = 2;

      expect(matcher(valueIndex, field, frame, data)).toBeTruthy();
    });

    it('should not match non-numeric values', () => {
      const frame = data[0];
      const field = frame.fields[0];
      const valueIndex = 1;

      expect(matcher(valueIndex, field, frame, data)).toBeFalsy();
    });
  });
});
