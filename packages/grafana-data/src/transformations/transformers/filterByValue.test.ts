import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { DataTransformerConfig, MatcherConfig } from '../../types/transformations';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ValueMatcherID } from '../matchers/ids';
import { BasicValueMatcherOptions } from '../matchers/valueMatchers/types';
import { transformDataFrame } from '../transformDataFrame';

import {
  FilterByValueMatch,
  filterByValueTransformer,
  FilterByValueTransformerOptions,
  FilterByValueType,
} from './filterByValue';
import { DataTransformerID } from './ids';

const seriesAWithSingleField = toDataFrame({
  name: 'A',
  length: 7,
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000, 5000, 6000, 7000] },
    { name: 'numbers', type: FieldType.number, values: [1, 2, 3, 4, 5, 6, 7] },
  ],
});

const multiSeriesWithSingleField = [
  toDataFrame({
    name: 'A',
    length: 3,
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
      { name: 'value', type: FieldType.number, values: [1, 0, 1] },
    ],
  }),
  toDataFrame({
    name: 'B',
    length: 3,
    fields: [
      { name: 'time', type: FieldType.time, values: [5000, 6000, 7000] },
      { name: 'value', type: FieldType.number, values: [0, 1, 1] },
    ],
  }),
];

let spyConsoleWarn: jest.SpyInstance;
describe('FilterByValue transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([filterByValueTransformer]);
  });

  beforeEach(() => {
    spyConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should exclude values', async () => {
    const lower: MatcherConfig<BasicValueMatcherOptions<number>> = {
      id: ValueMatcherID.lower,
      options: { value: 6 },
    };

    const cfg: DataTransformerConfig<FilterByValueTransformerOptions> = {
      id: DataTransformerID.filterByValue,
      options: {
        type: FilterByValueType.exclude,
        match: FilterByValueMatch.all,
        filters: [
          {
            fieldName: 'numbers',
            config: lower,
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [seriesAWithSingleField])).toEmitValuesWith((received) => {
      const processed = received[0];

      expect(processed.length).toEqual(1);
      expect(processed[0].fields).toEqual([
        {
          name: 'time',
          type: FieldType.time,
          values: [6000, 7000],
          state: {},
        },
        {
          name: 'numbers',
          type: FieldType.number,
          values: [6, 7],
          state: {},
        },
      ]);
    });
  });

  it('should not cross frame boundaries when equals 0', async () => {
    const cfg: DataTransformerConfig<FilterByValueTransformerOptions> = {
      id: DataTransformerID.filterByValue,
      options: {
        type: FilterByValueType.exclude,
        match: FilterByValueMatch.any,
        filters: [
          {
            fieldName: 'A value',
            config: {
              id: ValueMatcherID.equal,
              options: { value: 0 },
            },
          },
          {
            fieldName: 'B value',
            config: {
              id: ValueMatcherID.equal,
              options: { value: 0 },
            },
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], multiSeriesWithSingleField)).toEmitValuesWith((received) => {
      const processed = received[0];

      expect(processed.length).toEqual(2);

      expect(processed[0].fields).toEqual([
        {
          name: 'time',
          type: FieldType.time,
          values: [1000, 3000],
          state: {},
        },
        {
          name: 'value',
          type: FieldType.number,
          values: [1, 1],
          state: {},
        },
      ]);

      expect(processed[1].fields).toEqual([
        {
          name: 'time',
          type: FieldType.time,
          values: [6000, 7000],
          state: {},
        },
        {
          name: 'value',
          type: FieldType.number,
          values: [1, 1],
          state: {},
        },
      ]);

      expect(console.warn).toHaveBeenCalledTimes(2);
    });

    spyConsoleWarn.mockRestore();
  });

  it('should not cross frame boundaries', async () => {
    const cfg: DataTransformerConfig<FilterByValueTransformerOptions> = {
      id: DataTransformerID.filterByValue,
      options: {
        type: FilterByValueType.exclude,
        match: FilterByValueMatch.any,
        filters: [
          {
            fieldName: 'A value',
            config: {
              id: ValueMatcherID.greater,
              options: { value: 0 },
            },
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], multiSeriesWithSingleField)).toEmitValuesWith((received) => {
      const processed = received[0];
      expect(processed.length).toEqual(2);

      expect(processed[0].fields).toEqual([
        {
          name: 'time',
          type: FieldType.time,
          values: [2000],
          state: {},
        },
        {
          name: 'value',
          type: FieldType.number,
          values: [0],
          state: {},
        },
      ]);

      expect(processed[1].fields).toEqual([
        {
          name: 'time',
          type: FieldType.time,
          values: [5000, 6000, 7000],
          state: {},
        },
        {
          name: 'value',
          type: FieldType.number,
          values: [0, 1, 1],
          state: {},
        },
      ]);

      expect(console.warn).toHaveBeenCalledTimes(1);
    });
  });

  it('should include values', async () => {
    const lowerOrEqual: MatcherConfig<BasicValueMatcherOptions<number>> = {
      id: ValueMatcherID.lowerOrEqual,
      options: { value: 5 },
    };

    const cfg: DataTransformerConfig<FilterByValueTransformerOptions> = {
      id: DataTransformerID.filterByValue,
      options: {
        type: FilterByValueType.include,
        match: FilterByValueMatch.all,
        filters: [
          {
            fieldName: 'numbers',
            config: lowerOrEqual,
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [seriesAWithSingleField])).toEmitValuesWith((received) => {
      const processed = received[0];

      expect(processed.length).toEqual(1);
      expect(processed[0].fields).toEqual([
        {
          name: 'time',
          type: FieldType.time,
          values: [1000, 2000, 3000, 4000, 5000],
          state: {},
        },
        {
          name: 'numbers',
          type: FieldType.number,
          values: [1, 2, 3, 4, 5],
          state: {},
        },
      ]);
    });
  });

  it('should match any condition', async () => {
    const lowerOrEqual: MatcherConfig<BasicValueMatcherOptions<number>> = {
      id: ValueMatcherID.lowerOrEqual,
      options: { value: 4 },
    };

    const equal: MatcherConfig<BasicValueMatcherOptions<number>> = {
      id: ValueMatcherID.equal,
      options: { value: 7 },
    };

    const cfg: DataTransformerConfig<FilterByValueTransformerOptions> = {
      id: DataTransformerID.filterByValue,
      options: {
        type: FilterByValueType.include,
        match: FilterByValueMatch.any,
        filters: [
          {
            fieldName: 'numbers',
            config: lowerOrEqual,
          },
          {
            fieldName: 'numbers',
            config: equal,
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [seriesAWithSingleField])).toEmitValuesWith((received) => {
      const processed = received[0];

      expect(processed.length).toEqual(1);
      expect(processed[0].fields).toEqual([
        {
          name: 'time',
          type: FieldType.time,
          values: [1000, 2000, 3000, 4000, 7000],
          state: {},
        },
        {
          name: 'numbers',
          type: FieldType.number,
          values: [1, 2, 3, 4, 7],
          state: {},
        },
      ]);
    });
  });

  it('should match all condition', async () => {
    const greaterOrEqual: MatcherConfig<BasicValueMatcherOptions<number>> = {
      id: ValueMatcherID.greaterOrEqual,
      options: { value: 4 },
    };

    const lowerOrEqual: MatcherConfig<BasicValueMatcherOptions<number>> = {
      id: ValueMatcherID.lowerOrEqual,
      options: { value: 5 },
    };

    const cfg: DataTransformerConfig<FilterByValueTransformerOptions> = {
      id: DataTransformerID.filterByValue,
      options: {
        type: FilterByValueType.include,
        match: FilterByValueMatch.all,
        filters: [
          {
            fieldName: 'numbers',
            config: lowerOrEqual,
          },
          {
            fieldName: 'numbers',
            config: greaterOrEqual,
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [seriesAWithSingleField])).toEmitValuesWith((received) => {
      const processed = received[0];

      expect(processed.length).toEqual(1);
      expect(processed[0].fields).toEqual([
        {
          name: 'time',
          type: FieldType.time,
          values: [4000, 5000],
          state: {},
        },
        {
          name: 'numbers',
          type: FieldType.number,
          values: [4, 5],
          state: {},
        },
      ]);
    });
  });
});
