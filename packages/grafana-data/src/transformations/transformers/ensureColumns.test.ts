import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { ensureColumnsTransformer } from './ensureColumns';
import { DataTransformerID } from './ids';
import { joinByFieldTransformer } from './joinByField';

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
    mockTransformationsRegistry([ensureColumnsTransformer, joinByFieldTransformer]);
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
      expect(filtered[0]).toMatchInlineSnapshot(`
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "name": "TheTime",
              "state": Object {},
              "type": "time",
              "values": Array [
                1000,
                2000,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {},
              "name": "A",
              "state": Object {},
              "type": "number",
              "values": Array [
                1,
                100,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {},
              "name": "B",
              "state": Object {},
              "type": "number",
              "values": Array [
                2,
                200,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {},
              "name": "C",
              "state": Object {},
              "type": "number",
              "values": Array [
                3,
                300,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {},
              "name": "D",
              "state": Object {},
              "type": "string",
              "values": Array [
                "first",
                "second",
              ],
            },
          ],
          "length": 2,
          "meta": Object {
            "transformations": Array [
              "ensureColumns",
            ],
          },
        }
      `);
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
