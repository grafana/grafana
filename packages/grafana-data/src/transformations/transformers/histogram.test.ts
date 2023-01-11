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
      [
        {
          "config": {
            "unit": "mph",
          },
          "name": "xMin",
          "values": [
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
        {
          "config": {
            "unit": "mph",
          },
          "name": "xMax",
          "values": [
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
        {
          "config": {
            "unit": undefined,
          },
          "name": "A",
          "values": [
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
        {
          "config": {
            "unit": undefined,
          },
          "name": "B",
          "values": [
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
        {
          "config": {
            "unit": undefined,
          },
          "name": "C",
          "values": [
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
        {
          "config": {
            "unit": undefined,
          },
          "name": "C",
          "values": [
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
      [
        {
          "name": "xMin",
          "values": [
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
        {
          "name": "xMax",
          "values": [
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
        {
          "name": "count",
          "values": [
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
