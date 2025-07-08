import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType, Field } from '../../types/dataFrame';
import { DataTransformerConfig } from '../../types/transformations';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { limitTransformer, LimitTransformerOptions } from './limit';

describe('Limit transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([limitTransformer]);
  });

  it('should limit the number of items by removing from the end if the number is positive', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2, 3, 3, 3] },
      ],
    });

    const cfg: DataTransformerConfig<LimitTransformerOptions> = {
      id: DataTransformerID.limit,
      options: {
        limitField: 3,
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'time',
          type: FieldType.time,
          state: { calcs: undefined },
          values: [3000, 4000, 5000],
          config: {},
        },
        {
          name: 'message',
          type: FieldType.string,
          state: { calcs: undefined },
          values: ['one', 'two', 'two'],
          config: {},
        },
        {
          name: 'values',
          type: FieldType.number,
          state: { calcs: undefined },
          values: [1, 2, 2],
          config: {},
        },
      ];

      expect(result[0].fields).toEqual(expected);
    });
  });

  it('should limit the number of items by removing from the front if the limit is negative', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2, 3, 3, 3] },
      ],
    });

    const cfg: DataTransformerConfig<LimitTransformerOptions> = {
      id: DataTransformerID.limit,
      options: {
        limitField: -3,
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'time',
          type: FieldType.time,
          state: { calcs: undefined },
          values: [6000, 7000, 8000],
          config: {},
        },
        {
          name: 'message',
          type: FieldType.string,
          state: { calcs: undefined },
          values: ['three', 'three', 'three'],
          config: {},
        },
        {
          name: 'values',
          type: FieldType.number,
          state: { calcs: undefined },
          values: [3, 3, 3],
          config: {},
        },
      ];

      expect(result[0].fields).toEqual(expected);
    });
  });

  it('should not limit the number of items if limit > number of items', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2, 3, 3, 3] },
      ],
    });

    const cfg: DataTransformerConfig<LimitTransformerOptions> = {
      id: DataTransformerID.limit,
      options: {
        limitField: 7,
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'time',
          type: FieldType.time,
          values: [3000, 4000, 5000, 6000, 7000, 8000],
          config: {},
        },
        {
          name: 'message',
          type: FieldType.string,
          values: ['one', 'two', 'two', 'three', 'three', 'three'],
          config: {},
        },
        {
          name: 'values',
          type: FieldType.number,
          values: [1, 2, 2, 3, 3, 3],
          config: {},
        },
      ];

      expect(result[0].fields).toEqual(expected);
    });
  });
});
