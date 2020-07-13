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

  it('will transform to columns if time field exists and multiple frames', () => {
    const cfg = {
      id: DataTransformerID.ensureColumns,
      options: {},
    };

    const data = [seriesA, seriesBC];
    const filtered = transformDataFrame([cfg], data);

    expect(filtered.length).toEqual(1);
    expect(filtered[0]).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "labels": undefined,
            "name": "TheTime",
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
            "type": "string",
            "values": Array [
              "first",
              "second",
            ],
          },
        ],
        "meta": Object {
          "transformations": Array [
            "ensureColumns",
          ],
        },
        "name": undefined,
        "refId": undefined,
      }
    `);
  });

  it('will not transform to columns if time field is missing for any of the series', () => {
    const cfg = {
      id: DataTransformerID.ensureColumns,
      options: {},
    };

    const data = [seriesBC, seriesNoTime];
    const filtered = transformDataFrame([cfg], data);

    expect(filtered).toEqual(data);
  });

  it('will not transform to columns if only one series', () => {
    const cfg = {
      id: DataTransformerID.ensureColumns,
      options: {},
    };

    const data = [seriesBC];
    const filtered = transformDataFrame([cfg], data);

    expect(filtered).toEqual(data);
  });
});
