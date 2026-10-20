import { toDataFrame } from '../../../dataframe/processDataFrame';
import { type DataFrame } from '../../../types/dataFrame';
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

  describe('nullish values', () => {
    const nullishData: DataFrame[] = [
      toDataFrame({
        fields: [
          {
            name: 'temp',
            values: [null, undefined, 0, ''],
          },
        ],
      }),
    ];

    it.each(['.*', '.+', '\\w*', 'null', 'undefined'])('should not match null or undefined with %s', (value) => {
      const matcher = getValueMatcher({
        id: ValueMatcherID.regex,
        options: { value },
      });
      const frame = nullishData[0];
      const field = frame.fields[0];

      expect(matcher(0, field, frame, nullishData)).toBeFalsy();
      expect(matcher(1, field, frame, nullishData)).toBeFalsy();
    });

    it('should still match falsy non-nullish values', () => {
      const matcher = getValueMatcher({
        id: ValueMatcherID.regex,
        options: { value: '.*' },
      });
      const frame = nullishData[0];
      const field = frame.fields[0];

      expect(matcher(2, field, frame, nullishData)).toBeTruthy();
      expect(matcher(3, field, frame, nullishData)).toBeTruthy();
    });
  });
});
