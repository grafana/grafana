import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';

import { histogramTransformer, buildHistogram, histogramFieldsToFrame } from './histogram';

describe('histogram frames frames', () => {
  beforeAll(() => {
    mockTransformationsRegistry([histogramTransformer]);
  });

  it('by first time field', () => {
    const series1 = toDataFrame({
      fields: [
        { name: 'A', type: FieldType.number, values: [1, 2, 3, 4, 5] },
        { name: 'B', type: FieldType.number, values: [3, 4, 5, 6, 7], config: { unit: 'mph' } },
        { name: 'C', type: FieldType.number, values: [5, 6, 7, 8, 9] },
      ],
    });

    const series2 = toDataFrame({
      fields: [{ name: 'C', type: FieldType.number, values: [5, 6, 7, 8, 9] }],
    });

    const out = histogramFieldsToFrame(buildHistogram([series1, series2])!);
    expect(
      out.fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
        config: f.config,
      }))
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "config": Object {
            "unit": "mph",
          },
          "name": "xMin",
          "values": Array [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
          ],
        },
        Object {
          "config": Object {
            "unit": "mph",
          },
          "name": "xMax",
          "values": Array [
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
            10,
          ],
        },
        Object {
          "config": Object {
            "unit": undefined,
          },
          "name": "A",
          "values": Array [
            1,
            1,
            1,
            1,
            1,
            0,
            0,
            0,
            0,
          ],
        },
        Object {
          "config": Object {
            "unit": undefined,
          },
          "name": "B",
          "values": Array [
            0,
            0,
            1,
            1,
            1,
            1,
            1,
            0,
            0,
          ],
        },
        Object {
          "config": Object {
            "unit": undefined,
          },
          "name": "C",
          "values": Array [
            0,
            0,
            0,
            0,
            1,
            1,
            1,
            1,
            1,
          ],
        },
        Object {
          "config": Object {
            "unit": undefined,
          },
          "name": "C",
          "values": Array [
            0,
            0,
            0,
            0,
            1,
            1,
            1,
            1,
            1,
          ],
        },
      ]
    `);

    const out2 = histogramFieldsToFrame(buildHistogram([series1, series2], { combine: true })!);
    expect(
      out2.fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
      }))
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": "xMin",
          "values": Array [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
          ],
        },
        Object {
          "name": "xMax",
          "values": Array [
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
            10,
          ],
        },
        Object {
          "name": "count",
          "values": Array [
            1,
            1,
            2,
            2,
            4,
            3,
            3,
            2,
            2,
          ],
        },
      ]
    `);
  });
});
