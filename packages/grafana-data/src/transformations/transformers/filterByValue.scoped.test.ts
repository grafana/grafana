import { lastValueFrom } from 'rxjs';

import { toDataFrame } from '../../dataframe/processDataFrame';
import { type DataFrame, FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { getRowIdentity } from '../frameIdentity';
import { type RangeValueMatcherOptions } from '../matchers/valueMatchers/types';
import { transformDataFrame } from '../transformDataFrame';

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
const range = (options: RangeValueMatcherOptions<number>, fieldName = 'Value') =>
  config({ fieldName, config: { id: 'between', options: { ...options, inclusive: true, allowOpenBounds: true } } });

it('restores serialized filterByValue configs through the standard registry and isolates duplicate frames', async () => {
  const frames = [frame(), frame()];
  const filter = config({ fieldName: 'Value', config: { id: 'inSet', options: { values: [10, 3] } } });
  filter.options.target = { frameKey: '["A",1,1]', frameIndex: 1, refId: 'A' };
  const output = await lastValueFrom(transformDataFrame(JSON.parse(JSON.stringify([filter])), frames));
  expect(output[0].fields[1].values).toEqual([10, 2, 3, -1, null]);
  expect(output[1].fields[1].values).toEqual([10, 3]);
  expect(frames[1].fields[1].values).toEqual([10, 2, 3, -1, null]);
});

it('scopes child filters to a parent and ignores stale parent identities after refresh', async () => {
  const parent = toDataFrame({
    fields: [
      { name: 'Parent', type: FieldType.string, values: ['one', 'two'] },
      { name: 'Children', type: FieldType.nestedFrames, values: [[frame()], [frame()]] },
    ],
  });
  const filter = config({ fieldName: 'Value', config: { id: 'inSet', options: { values: [10, 3] } } });
  filter.options.target = {
    frameKey: '[null,0,1]',
    parentIndex: 0,
    parentKey: getRowIdentity(parent, 0),
  };
  const [output] = await lastValueFrom(transformDataFrame([filter], [parent]));
  expect(output.length).toBe(2);
  expect(output.fields[1].values[0][0].fields[1].values).toEqual([10, 3]);
  expect(output.fields[1].values[1][0].fields[1].values).toEqual([10, 2, 3, -1, null]);
  const refreshed: DataFrame = {
    ...parent,
    fields: [{ ...parent.fields[0], values: ['new', 'two'] }, parent.fields[1]],
  };
  const [next] = await lastValueFrom(transformDataFrame([filter], [refreshed]));
  expect(next.fields[1].values[0][0].fields[1].values).toEqual([10, 2, 3, -1, null]);
});

it('ignores a frame target when the query at that position changes', async () => {
  const filter = range({ from: 3, includeMissing: false });
  filter.options.target = { frameKey: '["A",0,1]', frameIndex: 0, refId: 'A' };
  const data = { ...frame(), refId: 'B' };
  const [output] = await lastValueFrom(transformDataFrame([filter], [data]));
  expect(output.fields[1].values).toEqual([10, 2, 3, -1, null]);
});

it('applies child filters before removing parent rows', async () => {
  const parent = toDataFrame({
    fields: [
      { name: 'Parent', type: FieldType.string, values: ['one', 'two'] },
      { name: 'Children', type: FieldType.nestedFrames, values: [[frame()], [frame()]] },
    ],
  });
  const frameKey = '[null,0,1]';
  const child = range({ from: 3, includeMissing: false });
  child.options.target = { frameKey, parentIndex: 1, parentKey: getRowIdentity(parent, 1) };
  const parents = config({ fieldName: 'Parent', config: { id: 'inSet', options: { values: ['two'] } } }, { frameKey });
  const [output] = await lastValueFrom(transformDataFrame([child, parents], [parent]));
  expect(output.fields[0].values).toEqual(['two']);
  expect(output.fields[1].values[0][0].fields[1].values).toEqual([10, 3]);
});
