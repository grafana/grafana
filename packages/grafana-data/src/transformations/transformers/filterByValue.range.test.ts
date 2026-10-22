import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { type RangeValueMatcherOptions } from '../matchers/valueMatchers/types';

import {
  filterByValueTransformer,
  FilterByValueMatch,
  FilterByValueType,
  type FilterByValueConfig,
} from './filterByValue';
import { DataTransformerID } from './ids';

mockTransformationsRegistry([filterByValueTransformer]);

function frame() {
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'Name', type: FieldType.string, values: ['item10', 'item2', 'item2', 'other', 'missing'] },
      { name: 'Value', type: FieldType.number, values: [10, 2, 3, -1, null] },
      { name: 'Time', type: FieldType.time, values: [1000, 1000, 1000, 2000, 3000], nanos: [3, 1, 2, 0, 0] },
    ],
  });
}

function config(predicate: FilterByValueConfig['options']['filters'][number]): FilterByValueConfig {
  return {
    id: DataTransformerID.filterByValue,
    options: {
      type: FilterByValueType.include,
      match: FilterByValueMatch.all,
      missingField: 'ignore',
      filters: [predicate],
    },
  };
}
const range = (options: RangeValueMatcherOptions<number>, fieldName = 'Value') =>
  config({ fieldName, config: { id: 'between', options: { ...options, inclusive: true, allowOpenBounds: true } } });

it.each([
  [{ from: 2, to: 10, includeMissing: false }, [10, 2, 3]],
  [{ from: 0, includeMissing: false }, [10, 2, 3]],
  [{ to: 0, includeMissing: false }, [-1]],
  [{ from: 20, includeMissing: true }, [null]],
  [{ includeMissing: false }, [10, 2, 3, -1]],
])('filters values for inclusive/open bounds and missing values: %j', (bounds, expected) => {
  expect(
    filterByValueTransformer.transformer(range(bounds).options, { interpolate: (s) => s })([frame()])[0].fields[1]
      .values
  ).toEqual(expected);
});

it('keeps nanoseconds aligned and includes both timestamp endpoints', () => {
  const data = frame();
  const output = filterByValueTransformer.transformer(
    range({ from: 1000, to: 2000, includeMissing: false }, 'Time').options,
    { interpolate: (s) => s }
  )([data])[0];
  expect(output.fields[2].values).toEqual([1000, 1000, 1000, 2000]);
  expect(output.fields[2].nanos).toEqual([3, 1, 2, 0]);
  expect(data.fields[2].nanos).toEqual([3, 1, 2, 0, 0]);
});

it.each([
  [false, [0, 1]],
  [true, [null, undefined, NaN, Infinity, 0, 1]],
])('handles non-finite values without numeric coercion (includeMissing=%s)', (includeMissing, expected) => {
  const data = toDataFrame({
    fields: [{ name: 'Value', type: FieldType.number, values: [null, undefined, NaN, Infinity, 0, 1, 2] }],
  });
  expect(
    filterByValueTransformer.transformer(range({ from: 0, to: 1, includeMissing }).options, { interpolate: (s) => s })([
      data,
    ])[0].fields[0].values
  ).toEqual(expected);
});
