import { lastValueFrom } from 'rxjs';

import { toDataFrame } from '../../dataframe/processDataFrame';
import { type DataFrame, FieldType } from '../../types/dataFrame';
import { MappingType } from '../../types/valueMapping';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import {
  filterByValueTransformer,
  FilterByValueMatch,
  FilterByValueType,
  type FilterByValueConfig,
} from './filterByValue';
import { DataTransformerID } from './ids';
import { sortByTransformer } from './sortBy';
import { tableFrameKey, tableParentKey, tableViewIndices, transformTableFrame } from './tableView';

mockTransformationsRegistry([filterByValueTransformer, sortByTransformer]);

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

it('matches mapped display values with a raw field identity despite display name overrides', () => {
  expect(
    tableViewIndices(frame(), [
      config({
        fieldName: 'Mapped value',
        field: { name: 'Value' },
        config: {
          id: 'inSet',
          options: {
            mode: 'display',
            values: ['small'],
            displayConfig: {
              mappings: [{ type: MappingType.RangeToText, options: { from: 1, to: 3, result: { text: 'small' } } }],
            },
          },
        },
      }),
    ])
  ).toEqual([1, 2]);
});

it('distinguishes strict raw membership from formatted membership and empty selections', () => {
  const data = toDataFrame({ fields: [{ name: 'Value', type: FieldType.other, values: [1, '1', null, ''] }] });
  const raw = (values: unknown[]) => config({ fieldName: 'Value', config: { id: 'inSet', options: { values } } });
  expect(tableViewIndices(data, [raw([1, null])])).toEqual([0, 2]);
  expect(tableViewIndices(data, [raw([])])).toEqual([]);
});

it.each([FilterByValueType.include, FilterByValueType.exclude])(
  'ignores missing fields for opted-in %s filters',
  (type) => {
    const missing = config({ fieldName: 'Gone', config: { id: 'inSet', options: { values: [10, 3] } } });
    missing.options.type = type;
    expect(tableViewIndices(frame(), [missing])).toEqual([0, 1, 2, 3, 4]);
  }
);

it('restores serialized filterByValue configs through the standard registry and isolates duplicate frames', async () => {
  const frames = [frame(), frame()];
  const filter = config({ fieldName: 'Value', config: { id: 'inSet', options: { values: [10, 3] } } });
  filter.options.target = { frameKey: tableFrameKey(frames, 1) };
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
    frameKey: tableFrameKey([parent], 0),
    parentIndex: 0,
    parentKey: tableParentKey(parent, 0),
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

it('reports lengths correctly when excluding rows from unequal frames', async () => {
  const other = toDataFrame({ fields: [{ name: 'Value', type: FieldType.number, values: [0, 2] }] });
  const filter = config({ fieldName: 'Value', config: { id: 'greater', options: { value: 1 } } });
  filter.options.type = FilterByValueType.exclude;
  const output = await lastValueFrom(transformDataFrame([filter], [frame(), other]));
  expect(output.map((f) => f.length)).toEqual([2, 1]);
  expect(output[1].fields[0].values).toEqual([0]);
});

it('addresses labelled fields sharing raw and display names without filtering the wrong series', () => {
  const data = toDataFrame({
    fields: [
      {
        name: 'Value',
        type: FieldType.number,
        labels: { region: 'east' },
        config: { displayName: 'Latency' },
        values: [1, 2, 3],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: { region: 'west' },
        config: { displayName: 'Latency' },
        values: [30, 10, 20],
      },
    ],
  });
  const filter = config({ fieldName: 'Latency', config: { id: 'inSet', options: { values: [30, 20] } } });
  filter.options.filters[0].field = { name: 'Value', labels: { region: 'west' } };
  expect(tableViewIndices(data, [filter])).toEqual([0, 2]);
});

it('preserves timezone formatting in serialized display membership', async () => {
  const data = toDataFrame({
    fields: [{ name: 'Value', type: FieldType.time, values: [Date.UTC(2026, 8, 18, 12), Date.UTC(2026, 8, 18, 16)] }],
  });
  const filter = config({
    fieldName: 'Value',
    config: {
      id: 'inSet',
      options: {
        mode: 'display',
        values: ['2026-09-18 08:00:00'],
        displayConfig: { unit: 'dateTimeAsIso' },
        timeZone: 'America/New_York',
      },
    },
  });
  const [output] = await lastValueFrom(transformDataFrame(JSON.parse(JSON.stringify([filter])), [data]));
  expect(output.fields[0].values).toEqual([Date.UTC(2026, 8, 18, 12)]);
});

it('filters numeric bounds and applies all sort keys with original row indices', () => {
  expect(
    tableViewIndices(frame(), [range({ min: 2, max: 10, includeMissing: false })], undefined, [
      { field: 'Name' },
      { field: 'Value', desc: true },
    ])
  ).toEqual([2, 1, 0]);
});

it('keeps nanoseconds aligned after filtering and sorting', () => {
  const output = transformTableFrame(frame(), [range({ min: 3, includeMissing: false })], undefined, [
    { field: 'Time' },
  ]);
  expect(output.fields[1].values).toEqual([3, 10]);
  expect(output.fields[2].nanos).toEqual([2, 3]);
});

it('keeps existing sort transformation single-key semantics unless explicitly opted in', async () => {
  const [output] = await lastValueFrom(
    transformDataFrame(
      [{ id: 'sortBy', options: { sort: [{ field: 'Name' }, { field: 'Value', desc: true }] } }],
      [frame()]
    )
  );
  expect(output.fields[1].values.slice(0, 3)).toEqual([10, 2, 3]);
});

it('sorts only the targeted frame after its filters have run', async () => {
  const frames = [frame(), frame()];
  const target = { frameKey: tableFrameKey(frames, 1) };
  const filter = range({ min: 3, includeMissing: false });
  filter.options.target = target;
  const output = await lastValueFrom(
    transformDataFrame(
      JSON.parse(
        JSON.stringify([filter, { id: 'sortBy', options: { table: true, target, sort: [{ field: 'Value' }] } }])
      ),
      frames
    )
  );
  expect(output[0].fields[1].values).toEqual([10, 2, 3, -1, null]);
  expect(output[1].fields[1].values).toEqual([3, 10]);
});

it('applies child filters before parent filtering and sorts surviving children separately', async () => {
  const parent = toDataFrame({
    fields: [
      { name: 'Parent', type: FieldType.string, values: ['one', 'two'] },
      { name: 'Children', type: FieldType.nestedFrames, values: [[frame()], [frame()]] },
    ],
  });
  const frameKey = tableFrameKey([parent], 0);
  const child = range({ min: 3, includeMissing: false });
  child.options.target = { frameKey, parentIndex: 1, parentKey: tableParentKey(parent, 1) };
  const parents = config({ fieldName: 'Parent', config: { id: 'inSet', options: { values: ['two'] } } }, { frameKey });
  const [output] = await lastValueFrom(
    transformDataFrame(
      [child, parents, { id: 'sortBy', options: { table: true, target: { frameKey }, sort: [{ field: 'Value' }] } }],
      [parent]
    )
  );
  expect(output.fields[0].values).toEqual(['two']);
  expect(output.fields[1].values[0][0].fields[1].values).toEqual([3, 10]);
});

it('sorts labelled fields by raw identity after formatted filtering', () => {
  const data = toDataFrame({
    fields: [
      { name: 'Value', type: FieldType.number, labels: { region: 'east' }, values: [1, 2, 3] },
      { name: 'Value', type: FieldType.number, labels: { region: 'west' }, values: [30, 10, 20] },
    ],
  });
  const filter = range({ min: 15, includeMissing: false }, 'West latency');
  filter.options.filters[0].field = { name: 'Value', labels: { region: 'west' } };
  expect(
    tableViewIndices(data, [filter], undefined, [
      { field: 'Value', displayName: 'West latency', fieldLabels: { region: 'west' } },
    ])
  ).toEqual([2, 0]);
});
