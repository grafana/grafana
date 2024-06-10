import { toDataFrame } from '../../dataframe/processDataFrame';
import { DataTransformerConfig, FieldType } from '../../types';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { transposeTransformer, TransposeTransformerOptions } from './transpose';

describe('Transpose transformer', () => {
  const cfg: DataTransformerConfig<TransposeTransformerOptions> = {
    id: DataTransformerID.transpose,
    options: {},
  };

  beforeAll(() => {
    mockTransformationsRegistry([transposeTransformer]);
  });

  it('should transpose full numeric values and keep numeric type', async () => {
    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'env', type: FieldType.string, values: ['dev', 'prod', 'staging', 'release', 'beta'] },
        { name: 'january', type: FieldType.number, values: [11, 12, 13, 14, 15] },
        { name: 'february', type: FieldType.number, values: [6, 7, 8, 9, 10] },
        { name: 'march', type: FieldType.number, values: [1, 2, 3, 4, 5] },
      ],
    });
    await expect(transformDataFrame([cfg], [seriesA])).toEmitValuesWith((received) => {
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
    const seriesB = toDataFrame({
      name: 'A',
      fields: [
        { name: 'env', type: FieldType.string, values: ['dev', 'prod', 'staging', 'release', 'beta'] },
        { name: 'january', type: FieldType.number, values: [11, 12, 13, 14, 15] },
        { name: 'february', type: FieldType.number, values: [6, 7, 8, 9, 10] },
        { name: 'type', type: FieldType.string, values: ['metricA', 'metricB', 'metricC', 'metricD', 'metricE'] },
      ],
    });
    await expect(transformDataFrame([cfg], [seriesB])).toEmitValuesWith((received) => {
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
          values: [11, 6, 'metricA'],
          config: {},
        },
        {
          name: 'prod',
          type: FieldType.string,
          values: [12, 7, 'metricB'],
          config: {},
        },
        {
          name: 'staging',
          type: FieldType.string,
          values: [13, 8, 'metricC'],
          config: {},
        },
        {
          name: 'release',
          type: FieldType.string,
          values: [14, 9, 'metricD'],
          config: {},
        },
        {
          name: 'beta',
          type: FieldType.string,
          values: [15, 10, 'metricE'],
          config: {},
        },
      ]);
    });
  });
});
