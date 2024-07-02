import { toDataFrame } from '../../dataframe/processDataFrame';
import { DataTransformerConfig, FieldType } from '../../types';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { transposeTransformer, TransposeTransformerOptions } from './transpose';

describe('Transpose transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([transposeTransformer]);
  });

  it('should transpose full numeric values and keep numeric type', async () => {
    const cfgA: DataTransformerConfig<TransposeTransformerOptions> = {
      id: DataTransformerID.transpose,
      options: {},
    };
    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'env', type: FieldType.string, values: ['dev', 'prod', 'staging', 'release', 'beta'] },
        { name: 'january', type: FieldType.number, values: [11, 12, 13, 14, 15] },
        { name: 'february', type: FieldType.number, values: [6, 7, 8, 9, 10] },
        { name: 'march', type: FieldType.number, values: [1, 2, 3, 4, 5] },
      ],
    });
    await expect(transformDataFrame([cfgA], [seriesA])).toEmitValuesWith((received) => {
      const result = received[0];
      expect(result[0].fields).toEqual([
        {
          name: 'env',
          type: FieldType.string,
          values: ['january', 'february', 'march'],
          config: {},
        },
        {
          name: 'dev',
          type: FieldType.number,
          values: [11, 6, 1],
          config: {},
        },
        {
          name: 'prod',
          type: FieldType.number,
          values: [12, 7, 2],
          config: {},
        },
        {
          name: 'staging',
          type: FieldType.number,
          values: [13, 8, 3],
          config: {},
        },
        {
          name: 'release',
          type: FieldType.number,
          values: [14, 9, 4],
          config: {},
        },
        {
          name: 'beta',
          type: FieldType.number,
          values: [15, 10, 5],
          config: {},
        },
      ]);
    });
  });

  it('should transpose and use string field type', async () => {
    const cfgB: DataTransformerConfig<TransposeTransformerOptions> = {
      id: DataTransformerID.transpose,
      options: {},
    };
    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'env', type: FieldType.string, values: ['dev', 'prod', 'staging', 'release', 'beta'] },
        { name: 'january', type: FieldType.number, values: [11, 12, 13, 14, 15] },
        { name: 'february', type: FieldType.number, values: [6, 7, 8, 9, 10] },
        { name: 'type', type: FieldType.string, values: ['metricA', 'metricB', 'metricC', 'metricD', 'metricE'] },
      ],
    });
    await expect(transformDataFrame([cfgB], [seriesB])).toEmitValuesWith((received) => {
      const result = received[0];
      expect(result[0].fields).toEqual([
        {
          name: 'env',
          type: FieldType.string,
          values: ['january', 'february', 'type'],
          config: {},
        },
        {
          name: 'dev',
          type: FieldType.string,
          values: ['11', '6', 'metricA'],
          config: {},
        },
        {
          name: 'prod',
          type: FieldType.string,
          values: ['12', '7', 'metricB'],
          config: {},
        },
        {
          name: 'staging',
          type: FieldType.string,
          values: ['13', '8', 'metricC'],
          config: {},
        },
        {
          name: 'release',
          type: FieldType.string,
          values: ['14', '9', 'metricD'],
          config: {},
        },
        {
          name: 'beta',
          type: FieldType.string,
          values: ['15', '10', 'metricE'],
          config: {},
        },
      ]);
    });
  });

  it('should transpose and keep number types and add new headers', async () => {
    const cfgC: DataTransformerConfig<TransposeTransformerOptions> = {
      id: DataTransformerID.transpose,
      options: {
        addNewFields: true,
        renameFirstField: 'NewField',
      },
    };
    const seriesC = toDataFrame({
      name: 'C',
      fields: [
        { name: 'A', type: FieldType.number, values: [1, 5] },
        { name: 'B', type: FieldType.number, values: [2, 6] },
        { name: 'C', type: FieldType.number, values: [3, 7] },
        { name: 'D', type: FieldType.number, values: [4, 8] },
      ],
    });
    await expect(transformDataFrame([cfgC], [seriesC])).toEmitValuesWith((received) => {
      const result = received[0];
      expect(result[0].fields).toEqual([
        {
          name: 'NewField',
          type: FieldType.string,
          values: ['A', 'B', 'C', 'D'],
          config: {},
        },
        {
          name: 'Value1',
          type: FieldType.number,
          values: [1, 2, 3, 4],
          config: {},
        },
        {
          name: 'Value2',
          type: FieldType.number,
          values: [5, 6, 7, 8],
          config: {},
        },
      ]);
    });
  });

  it('should transpose and handle different types and rename first element', async () => {
    const cfgD: DataTransformerConfig<TransposeTransformerOptions> = {
      id: DataTransformerID.transpose,
      options: {
        renameFirstField: 'Field1',
      },
    };
    const seriesD = toDataFrame({
      name: 'D',
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: ['2024-06-10 08:30:00', '2024-06-10 08:31:00', '2024-06-10 08:32:00', '2024-06-10 08:33:00'],
        },
        { name: 'value', type: FieldType.number, values: [1, 2, 3, 4] },
      ],
    });
    await expect(transformDataFrame([cfgD], [seriesD])).toEmitValuesWith((received) => {
      const result = received[0];
      expect(result[0].fields).toEqual([
        {
          name: 'Field1',
          type: FieldType.string,
          values: ['value'],
          config: {},
        },
        {
          name: '2024-06-10 08:30:00',
          type: FieldType.number,
          values: [1],
          config: {},
        },
        {
          name: '2024-06-10 08:31:00',
          type: FieldType.number,
          values: [2],
          config: {},
        },
        {
          name: '2024-06-10 08:32:00',
          type: FieldType.number,
          values: [3],
          config: {},
        },
        {
          name: '2024-06-10 08:33:00',
          type: FieldType.number,
          values: [4],
          config: {},
        },
      ]);
    });
  });
});
