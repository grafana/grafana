import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { calculateFieldTransformer } from './calculateField';
import { alignDataFrames } from './joinDataFrames';

describe('align frames', () => {
  beforeAll(() => {
    mockTransformationsRegistry([calculateFieldTransformer]);
  });

  it('by first time field', () => {
    const series1 = toDataFrame({
      fields: [
        { name: 'TheTime', type: FieldType.time, values: [1000, 2000] },
        { name: 'A', type: FieldType.number, values: [1, 100] },
      ],
    });

    const series2 = toDataFrame({
      fields: [
        { name: '_time', type: FieldType.time, values: [1000, 1500, 2000] },
        { name: 'A', type: FieldType.number, values: [2, 20, 200] },
        { name: 'B', type: FieldType.number, values: [3, 30, 300] },
        { name: 'C', type: FieldType.string, values: ['first', 'second', 'third'] },
      ],
    });

    const out = alignDataFrames({ data: [series1, series2] })!;
    expect(
      out.fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
      }))
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": "TheTime",
          "values": Array [
            1000,
            1500,
            2000,
          ],
        },
        Object {
          "name": "A",
          "values": Array [
            1,
            null,
            100,
          ],
        },
        Object {
          "name": "A",
          "values": Array [
            2,
            20,
            200,
          ],
        },
        Object {
          "name": "B",
          "values": Array [
            3,
            30,
            300,
          ],
        },
        Object {
          "name": "C",
          "values": Array [
            "first",
            "second",
            "third",
          ],
        },
      ]
    `);
  });

  it('unsorted input', () => {
    //----------
    const series1 = toDataFrame({
      fields: [
        { name: 'TheTime', type: FieldType.time, values: [1000, 2000, 1500] },
        { name: 'A1', type: FieldType.number, values: [1, 2, 15] },
      ],
    });

    const series3 = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [2000, 1000] },
        { name: 'A2', type: FieldType.number, values: [2, 1] },
      ],
    });

    const out = alignDataFrames({ data: [series1, series3] })!;
    expect(
      out.fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
      }))
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": "TheTime",
          "values": Array [
            1000,
            1500,
            2000,
          ],
        },
        Object {
          "name": "A1",
          "values": Array [
            1,
            15,
            2,
          ],
        },
        Object {
          "name": "A2",
          "values": Array [
            1,
            null,
            2,
          ],
        },
      ]
    `);
  });

  it('supports duplicate times', () => {
    //----------
    // NOTE!!!
    // * ideally we would *keep* dupicate fields
    //----------
    const series1 = toDataFrame({
      fields: [
        { name: 'TheTime', type: FieldType.time, values: [1000, 2000] },
        { name: 'A', type: FieldType.number, values: [1, 100] },
      ],
    });

    const series3 = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 1000, 1000] },
        { name: 'A', type: FieldType.number, values: [2, 20, 200] },
      ],
    });

    const out = alignDataFrames({ data: [series1, series3] })!;
    expect(
      out.fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
      }))
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": "TheTime",
          "values": Array [
            1000,
            2000,
          ],
        },
        Object {
          "name": "A",
          "values": Array [
            1,
            100,
          ],
        },
        Object {
          "name": "A",
          "values": Array [
            200,
            null,
          ],
        },
      ]
    `);
  });
});
