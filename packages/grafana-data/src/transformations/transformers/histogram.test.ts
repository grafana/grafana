import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { histogramTransformer, buildHistogram } from './histogram';

describe('histogram frames frames', () => {
  beforeAll(() => {
    mockTransformationsRegistry([histogramTransformer]);
  });

  it('by first time field', () => {
    const series1 = toDataFrame({
      fields: [
        { name: 'A', type: FieldType.number, values: [1, 2, 3, 4, 5] },
        { name: 'B', type: FieldType.number, values: [3, 4, 5, 6, 7] },
        { name: 'C', type: FieldType.number, values: [5, 6, 7, 8, 9] },
      ],
    });

    const series2 = toDataFrame({
      fields: [{ name: 'C', type: FieldType.number, values: [5, 6, 7, 8, 9] }],
    });

    const out = buildHistogram([series1, series2]);
    expect(
      out.fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
      }))
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": "BucketMin",
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
          "name": "BucketMax",
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
          "name": "A",
          "values": Array [
            1,
            1,
            1,
            1,
            1,
            undefined,
            undefined,
            undefined,
            undefined,
          ],
        },
        Object {
          "name": "B",
          "values": Array [
            undefined,
            undefined,
            1,
            1,
            1,
            1,
            1,
            undefined,
            undefined,
          ],
        },
        Object {
          "name": "C",
          "values": Array [
            undefined,
            undefined,
            undefined,
            undefined,
            1,
            1,
            1,
            1,
            1,
          ],
        },
        Object {
          "name": "C",
          "values": Array [
            undefined,
            undefined,
            undefined,
            undefined,
            1,
            1,
            1,
            1,
            1,
          ],
        },
      ]
    `);
  });
});
