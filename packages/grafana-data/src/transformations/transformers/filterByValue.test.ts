import { toDataFrame } from '../../dataframe/processDataFrame';
import { DataTransformerConfig, FieldType, MatcherConfig } from '../../types';
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

describe('FilterByValue transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([filterByValueTransformer]);
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
