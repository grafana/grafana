import { toDataFrame } from '../../../dataframe/processDataFrame';
import { type DataFrame, FieldType } from '../../../types/dataFrame';
import { getValueMatcher, valueMatchers } from '../../matchers';
import { ValueMatcherID } from '../ids';

import { type RangeValueMatcherOptions } from './types';

describe('between compatibility', () => {
  it('preserves defaults, applicability and display text', () => {
    const info = valueMatchers.get(ValueMatcherID.between);
    const frame = toDataFrame({
      fields: [
        { name: 'Value', type: FieldType.number, values: [1] },
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Text', type: FieldType.string, values: ['1'] },
      ],
    });
    expect(frame.fields.map((field) => info.isApplicable(field))).toEqual([true, true, false]);
    expect(info.getDefaultOptions(frame.fields[0])).toEqual({ from: 0, to: 100 });
    expect(info.getDefaultOptions(frame.fields[1])).toEqual({ from: '$__from', to: '$__to' });
    expect(info.getOptionsDisplayText?.({ from: 0, to: 2 })).toBe(
      'Matches all rows where field value is between 0 and 2.'
    );
  });
  it.each([
    { name: 'exclusive endpoints', options: { from: 0, to: 2 }, values: [-1, 0, 1, 2, 3], expected: [1] },
    {
      name: 'legacy coercion',
      options: { from: -1, to: 2 },
      values: [null, undefined, NaN, Infinity, -Infinity, '', '1', false, true, 1],
      expected: [null, '', '1', false, true, 1],
    },
    {
      name: 'string bounds use parseInt',
      options: { from: '1.9', to: '3.9' },
      values: [1, 1.5, 2, 3, 3.5],
      expected: [1.5, 2],
    },
    { name: 'missing lower bound', options: { to: 2 }, values: [0, 1, 2], expected: [] },
    { name: 'missing upper bound', options: { from: 0 }, values: [0, 1, 2], expected: [] },
    { name: 'missing both bounds', options: {}, values: [0, 1, 2], expected: [] },
    { name: 'invalid bound', options: { from: 'invalid', to: 2 }, values: [0, 1, 2], expected: [] },
    {
      name: 'infinite bounds',
      options: { from: -Infinity, to: Infinity },
      values: [-Infinity, 0, Infinity],
      expected: [0],
    },
  ])('$name', ({ options, values, expected }) => {
    const frame = toDataFrame({ fields: [{ name: 'Value', type: FieldType.number, values }] });
    const matcher = getValueMatcher({ id: ValueMatcherID.between, options });
    expect(frame.fields[0].values.filter((_, index) => matcher(index, frame.fields[0], frame, [frame]))).toEqual(
      expected
    );
  });
});

describe('extended between', () => {
  it.each([
    { inclusive: false, expected: [1500] },
    { inclusive: true, expected: [1000, 1500, 2000] },
  ])('matches interpolated timestamp bounds with inclusive=$inclusive', ({ inclusive, expected }) => {
    const frame = toDataFrame({ fields: [{ name: 'Time', type: FieldType.time, values: [1000, 1500, 2000] }] });
    const matcher = getValueMatcher({
      id: ValueMatcherID.between,
      options: { from: '1000', to: '2000', inclusive, includeMissing: false },
    });
    expect(frame.fields[0].values.filter((_, index) => matcher(index, frame.fields[0], frame, [frame]))).toEqual(
      expected
    );
  });

  it.each<{ options: RangeValueMatcherOptions; expected: string }>([
    {
      options: { from: 0, inclusive: true, allowOpenBounds: true, includeMissing: false },
      expected: 'Matches all rows where field value is between 0 and ∞ (inclusive). Finite numbers only.',
    },
    {
      options: { to: 2, allowOpenBounds: true, includeMissing: true },
      expected:
        'Matches all rows where field value is between -∞ and 2. Includes missing, non-numeric and non-finite values.',
    },
  ])('describes extended options: $options', ({ options, expected }) => {
    expect(valueMatchers.get(ValueMatcherID.between).getOptionsDisplayText?.(options)).toBe(expected);
  });
  it.each([
    { name: 'inclusive endpoints', options: { from: 0, to: 2, inclusive: true }, expected: [0, 1, 2] },
    { name: 'explicit exclusive endpoints', options: { from: 0, to: 2, inclusive: false }, expected: [1] },
    { name: 'inclusive lower bound', options: { from: 1, inclusive: true, allowOpenBounds: true }, expected: [1, 2] },
    { name: 'inclusive upper bound', options: { to: 1, inclusive: true, allowOpenBounds: true }, expected: [-1, 0, 1] },
    { name: 'exclusive lower bound', options: { from: 1, allowOpenBounds: true }, expected: [2] },
    { name: 'exclusive upper bound', options: { to: 1, allowOpenBounds: true }, expected: [-1, 0] },
    { name: 'both bounds open', options: { allowOpenBounds: true }, expected: [-1, 0, 1, 2] },
    { name: 'inclusive does not enable open bounds', options: { from: 1, inclusive: true }, expected: [] },
    { name: 'equal inclusive bounds', options: { from: 1, to: 1, inclusive: true }, expected: [1] },
    { name: 'reversed bounds', options: { from: 2, to: 0, inclusive: true }, expected: [] },
    { name: 'invalid is not unbounded', options: { from: 'invalid', allowOpenBounds: true }, expected: [] },
  ])('$name', ({ options, expected }) => {
    const frame = toDataFrame({ fields: [{ name: 'Value', type: FieldType.number, values: [-1, 0, 1, 2] }] });
    const matcher = getValueMatcher({ id: ValueMatcherID.between, options });
    expect(frame.fields[0].values.filter((_, index) => matcher(index, frame.fields[0], frame, [frame]))).toEqual(
      expected
    );
  });

  it.each([
    {
      name: 'omitted policy retains coercion',
      includeMissing: undefined,
      expected: [null, '', '1', false, true, 0, 1],
    },
    { name: 'false accepts only finite numbers', includeMissing: false, expected: [0, 1] },
    {
      name: 'true includes missing and non-numeric values',
      includeMissing: true,
      expected: [null, undefined, NaN, Infinity, -Infinity, '', '1', false, true, 0, 1],
    },
  ])('$name', ({ includeMissing, expected }) => {
    const frame = toDataFrame({
      fields: [
        {
          name: 'Value',
          type: FieldType.number,
          values: [null, undefined, NaN, Infinity, -Infinity, '', '1', false, true, 0, 1, 2],
        },
      ],
    });
    const matcher = getValueMatcher({
      id: ValueMatcherID.between,
      options: { from: 0, to: 1, inclusive: true, includeMissing },
    });
    expect(frame.fields[0].values.filter((_, index) => matcher(index, frame.fields[0], frame, [frame]))).toEqual(
      expected
    );
  });
});

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
