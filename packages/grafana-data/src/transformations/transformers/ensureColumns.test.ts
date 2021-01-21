import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';
import { ensureColumnsTransformer } from './ensureColumns';
import { seriesToColumnsTransformer } from './seriesToColumns';

const seriesA = toDataFrame({
  fields: [
    { name: 'TheTime', type: FieldType.time, values: [1000, 2000] },
    { name: 'A', type: FieldType.number, values: [1, 100] },
  ],
});

const seriesBC = toDataFrame({
  fields: [
    { name: 'TheTime', type: FieldType.time, values: [1000, 2000] },
    { name: 'B', type: FieldType.number, values: [2, 200] },
    { name: 'C', type: FieldType.number, values: [3, 300] },
    { name: 'D', type: FieldType.string, values: ['first', 'second'] },
  ],
});

const seriesNoTime = toDataFrame({
  fields: [
    { name: 'B', type: FieldType.number, values: [2, 200] },
    { name: 'C', type: FieldType.number, values: [3, 300] },
    { name: 'D', type: FieldType.string, values: ['first', 'second'] },
  ],
});

describe('ensureColumns transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([ensureColumnsTransformer, seriesToColumnsTransformer]);
  });

  it('will transform to columns if time field exists and multiple frames', async () => {
    const cfg = {
      id: DataTransformerID.ensureColumns,
      options: {},
    };

    const data = [seriesA, seriesBC];

    await expect(transformDataFrame([cfg], data)).toEmitValuesWith((received) => {
      const filtered = received[0];
      expect(filtered.length).toEqual(1);

      const frame = filtered[0];
      expect(frame.fields.length).toEqual(5);
      expect(filtered[0]).toEqual(
        toDataFrame({
          fields: [
            {
              name: 'TheTime',
              type: 'time',
              config: {},
              values: [1000, 2000],
              labels: undefined,
            },
            {
              name: 'A',
              type: 'number',
              config: {},
              values: [1, 100],
              labels: {},
            },
            {
              name: 'B',
              type: 'number',
              config: {},
              values: [2, 200],
              labels: {},
            },
            {
              name: 'C',
              type: 'number',
              config: {},
              values: [3, 300],
              labels: {},
            },
            {
              name: 'D',
              type: 'string',
              config: {},
              values: ['first', 'second'],
              labels: {},
            },
          ],
          meta: {
            transformations: ['ensureColumns'],
          },
          name: undefined,
          refId: undefined,
        })
      );
    });
  });

  it('will not transform to columns if time field is missing for any of the series', async () => {
    const cfg = {
      id: DataTransformerID.ensureColumns,
      options: {},
    };

    const data = [seriesBC, seriesNoTime];

    await expect(transformDataFrame([cfg], data)).toEmitValues([data]);
  });

  it('will not transform to columns if only one series', async () => {
    const cfg = {
      id: DataTransformerID.ensureColumns,
      options: {},
    };

    const data = [seriesBC];

    await expect(transformDataFrame([cfg], data)).toEmitValues([data]);
  });
});
