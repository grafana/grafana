import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';

import {
  filterByValueTransformer,
  FilterByValueMatch,
  FilterByValueType,
  type FilterByValueConfig,
} from './filterByValue';
import { DataTransformerID } from './ids';
import { tableViewIndices, transformTableFrame } from './tableView';

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

function config(
  predicate: FilterByValueConfig['options']['filters'][number],
  target?: FilterByValueConfig['options']['target']
): FilterByValueConfig {
  return {
    id: DataTransformerID.filterByValue,
    options: {
      type: FilterByValueType.include,
      match: FilterByValueMatch.all,
      missingField: 'ignore',
      filters: [predicate],
      target,
    },
  };
}
const range = (options: { min?: number; max?: number; includeMissing: boolean }, fieldName = 'Value') =>
  config({ fieldName, config: { id: 'numericRange', options } });

it.each([
  [{ min: 2, max: 10, includeMissing: false }, [0, 1, 2]],
  [{ min: 0, includeMissing: false }, [0, 1, 2]],
  [{ max: 0, includeMissing: false }, [3]],
  [{ min: 20, includeMissing: true }, [4]],
  [{ includeMissing: false }, [0, 1, 2, 3]],
])('projects source indices for inclusive/open bounds and missing values: %j', (bounds, expected) => {
  expect(tableViewIndices(frame(), [range(bounds)])).toEqual(expected);
});

it('keeps nanoseconds aligned and includes both timestamp endpoints', () => {
  const output = transformTableFrame(frame(), [range({ min: 1000, max: 2000, includeMissing: false }, 'Time')]);
  expect(output.fields[2].values).toEqual([1000, 1000, 1000, 2000]);
  expect(output.fields[2].nanos).toEqual([3, 1, 2, 0]);
  expect(frame().fields[2].nanos).toEqual([3, 1, 2, 0, 0]);
});

it.each([
  [false, [4, 5]],
  [true, [0, 1, 2, 3, 4, 5]],
])('handles non-finite values without numeric coercion (includeMissing=%s)', (includeMissing, expected) => {
  const data = toDataFrame({
    fields: [{ name: 'Value', type: FieldType.number, values: [null, undefined, NaN, Infinity, 0, 1, 2] }],
  });
  expect(tableViewIndices(data, [range({ min: 0, max: 1, includeMissing })])).toEqual(expected);
});
