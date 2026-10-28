import { lastValueFrom } from 'rxjs';

import { toDataFrame } from '../../dataframe/processDataFrame';
import { getDisplayProcessor } from '../../field/displayProcessor';
import { createTheme } from '../../themes/createTheme';
import { FieldType } from '../../types/dataFrame';
import { MappingType } from '../../types/valueMapping';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
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

it('matches mapped display values with a raw field identity despite display name overrides', () => {
  expect(
    filterByValueTransformer.transformer(
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
      }).options,
      { interpolate: (s) => s }
    )([frame()])[0].fields[1].values
  ).toEqual([2, 3]);
});

it('distinguishes strict raw membership from formatted membership and empty selections', () => {
  const data = toDataFrame({ fields: [{ name: 'Value', type: FieldType.other, values: [1, '1', null, ''] }] });
  const raw = (values: unknown[]) => config({ fieldName: 'Value', config: { id: 'inSet', options: { values } } });
  expect(
    filterByValueTransformer.transformer(raw([1, null]).options, { interpolate: (s) => s })([data])[0].fields[0].values
  ).toEqual([1, null]);
  expect(
    filterByValueTransformer.transformer(raw([]).options, { interpolate: (s) => s })([data])[0].fields[0].values
  ).toEqual([]);
});

it.each([FilterByValueType.include, FilterByValueType.exclude])(
  'ignores missing fields for opted-in %s filters',
  (type) => {
    const missing = config({ fieldName: 'Gone', config: { id: 'inSet', options: { values: [10, 3] } } });
    missing.options.type = type;
    const data = frame();
    expect(filterByValueTransformer.transformer(missing.options, { interpolate: (s) => s })([data])[0]).toBe(data);
  }
);

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
  expect(
    filterByValueTransformer.transformer(filter.options, { interpolate: (s) => s })([data])[0].fields[1].values
  ).toEqual([30, 20]);
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

it.each([
  { existingDisplay: true, selected: '2026-09-18 12:00:00' },
  { existingDisplay: false, selected: '2026-09-18 08:00:00' },
])(
  'uses field display when present ($existingDisplay), otherwise the matcher timezone',
  ({ existingDisplay, selected }) => {
    const data = toDataFrame({
      fields: [
        {
          name: 'Time',
          type: FieldType.time,
          config: { unit: 'dateTimeAsIso' },
          values: [Date.UTC(2026, 8, 18, 12), Date.UTC(2026, 8, 18, 16)],
        },
      ],
    });
    if (existingDisplay) {
      data.fields[0].display = getDisplayProcessor({ field: data.fields[0], theme: createTheme(), timeZone: 'utc' });
    }
    const filter = config({
      fieldName: 'Time',
      config: {
        id: 'inSet',
        options: { mode: 'display', values: [selected], timeZone: 'America/New_York' },
      },
    });

    const [output] = filterByValueTransformer.transformer(filter.options, { interpolate: (s) => s })([data]);

    expect(output.fields[0].values).toEqual([Date.UTC(2026, 8, 18, 12)]);
  }
);

it('keeps values and nanoseconds aligned after filtering', () => {
  const filter = range({ from: 3, includeMissing: false });
  const output = filterByValueTransformer.transformer(filter.options, { interpolate: (s) => s })([frame()])[0];
  expect(output.fields[1].values).toEqual([10, 3]);
  expect(output.fields[2].nanos).toEqual([3, 2]);
});
