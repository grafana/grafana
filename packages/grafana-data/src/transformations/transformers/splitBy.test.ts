import { DataTransformerConfig } from '@grafana/data';

import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { splitByTransformer, SplitByTransformerOptions } from './splitBy';

describe('SplitBy transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([splitByTransformer]);
  });

  it('should not apply transformation when # of frames > 1', async () => {
    const testSeries = [
      {
        name: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [3000, 4000, 5000] },
          { name: 'group', type: FieldType.string, values: ['one', 'two', 'two'] },
          { name: 'values', type: FieldType.number, values: [1, 2, 2] },
        ],
      },
      {
        name: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [6000, 7000, 8000] },
          { name: 'group', type: FieldType.string, values: ['three', 'three', 'three'] },
          { name: 'values', type: FieldType.number, values: [3, 3, 3] },
        ],
      },
    ].map(toDataFrame);

    const cfg: DataTransformerConfig<SplitByTransformerOptions> = {
      id: DataTransformerID.splitBy,
      options: {
        field: 'group',
      },
    };

    await expect(transformDataFrame([cfg], testSeries)).toEmitValuesWith((received) => {
      expect(received[0]).toBe(testSeries);
    });
  });

  it('should not apply transformation selected field does not exist', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000] },
        { name: 'group', type: FieldType.string, values: ['one', 'two', 'two'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2] },
      ],
    });

    const cfg: DataTransformerConfig<SplitByTransformerOptions> = {
      id: DataTransformerID.splitBy,
      options: {
        field: 'category',
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      expect(received[0][0]).toBe(testSeries);
    });
  });

  it('should split by group column', async () => {
    const testSeries = toDataFrame({
      name: 'Series A',
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
        { name: 'group', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2, 3, 3, 3], config: { unit: 'm' } },
      ],
    });

    const cfg: DataTransformerConfig<SplitByTransformerOptions> = {
      id: DataTransformerID.splitBy,
      options: {
        field: 'group',
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      expect(received[0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'one',
            refId: 'A',
            fields: [
              {
                name: 'time',
                type: FieldType.time,
                values: [3000],
                config: {},
              },
              {
                name: 'values',
                type: FieldType.number,
                values: [1],
                config: { unit: 'm' },
              },
            ],
          }),
          expect.objectContaining({
            name: 'two',
            refId: 'A',
            fields: [
              {
                name: 'time',
                type: FieldType.time,
                values: [4000, 5000],
                config: {},
              },
              {
                name: 'values',
                type: FieldType.number,
                values: [2, 2],
                config: { unit: 'm' },
              },
            ],
          }),
          expect.objectContaining({
            name: 'three',
            refId: 'A',
            fields: [
              {
                name: 'time',
                type: FieldType.time,
                values: [6000, 7000, 8000],
                config: {},
              },
              {
                name: 'values',
                type: FieldType.number,
                values: [3, 3, 3],
                config: { unit: 'm' },
              },
            ],
          }),
        ])
      );
    });
  });
});
