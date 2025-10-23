import { toDataFrame } from '../../dataframe/processDataFrame';
import { Field, FieldType } from '../../types/dataFrame';
import { DataFrameType } from '../../types/dataFrameTypes';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';

import {
  histogramTransformer,
  buildHistogram,
  histogramFieldsToFrame,
  HistogramFields,
  joinHistograms,
  getHistogramFields,
} from './histogram';

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

    const series3 = toDataFrame({
      fields: [{ name: 'D', type: FieldType.number, values: [1, 2, 3, null, null] }],
    });

    const series4 = toDataFrame({
      fields: [{ name: 'E', type: FieldType.number, values: [4, 5, null, 6, null], config: { noValue: '0' } }],
    });

    const out = histogramFieldsToFrame(buildHistogram([series1, series2])!);
    expect(
      out.fields.map((f) => ({
        name: f.name,
        values: f.values,
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
        values: f.values,
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

    // NULLs filtering test
    const out3 = histogramFieldsToFrame(buildHistogram([series3])!);
    expect(
      out3.fields.map((f) => ({
        name: f.name,
        values: f.values,
      }))
    ).toMatchInlineSnapshot(`
      [
        {
          "name": "xMin",
          "values": [
            1,
            2,
            3,
          ],
        },
        {
          "name": "xMax",
          "values": [
            2,
            3,
            4,
          ],
        },
        {
          "name": "D",
          "values": [
            1,
            1,
            1,
          ],
        },
      ]
    `);

    // noValue nulls test
    const out4 = histogramFieldsToFrame(buildHistogram([series4])!);
    expect(
      out4.fields.map((f) => ({
        name: f.name,
        values: f.values,
        config: f.config,
      }))
    ).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "name": "xMin",
          "values": [
            0,
            4,
            5,
            6,
          ],
        },
        {
          "config": {},
          "name": "xMax",
          "values": [
            1,
            5,
            6,
            7,
          ],
        },
        {
          "config": {
            "noValue": "0",
            "unit": undefined,
          },
          "name": "E",
          "values": [
            2,
            1,
            1,
            1,
          ],
        },
      ]
    `);
  });
});

describe('getHistogramFields', () => {
  it('densifies sparse native histograms (heatmap-cells)', () => {
    expect(
      getHistogramFields(
        toDataFrame({
          meta: {
            type: DataFrameType.HeatmapCells,
          },
          fields: [
            { name: 'yMin', type: FieldType.number, values: [512, 2048] },
            { name: 'yMax', type: FieldType.number, values: [1024, 4096] },
            { name: 'count', type: FieldType.number, values: [10, 10] },
          ],
        })
      )
    ).toMatchInlineSnapshot(`
      {
        "counts": [
          {
            "config": {},
            "name": "count",
            "type": "number",
            "values": [
              10,
              0,
              10,
            ],
          },
        ],
        "xMax": {
          "config": {},
          "name": "xMax",
          "type": "number",
          "values": [
            1024,
            2048,
            4096,
          ],
        },
        "xMin": {
          "config": {},
          "name": "xMin",
          "type": "number",
          "values": [
            512,
            1024,
            2048,
          ],
        },
      }
  `);
  });
});

describe('joinHistograms', () => {
  type TestHistogram = {
    xMin: number[];
    xMax: number[];
    counts: number[][];
  };

  function toField(name: string, values: number[]): Field {
    return {
      config: {},
      name,
      type: FieldType.number,
      values,
    };
  }

  function testHistogramToHistogram(test: TestHistogram): HistogramFields {
    return {
      xMin: toField('xMin', test.xMin),
      xMax: toField('xMax', test.xMax),
      counts: test.counts.map((values) => toField(`count`, values)),
    };
  }

  type TestCase = {
    name: string;
    histograms: TestHistogram[];
    expected: TestHistogram;
  };

  const testCases: TestCase[] = [
    {
      name: 'just one histogram',
      histograms: [
        {
          xMin: [1, 2, 3],
          xMax: [2, 3, 4],
          counts: [[1, 2, 3]],
        },
      ],
      expected: {
        xMin: [1, 2, 3],
        xMax: [2, 3, 4],
        counts: [[1, 2, 3]],
      },
    },
    {
      name: 'two histograms with same bucket sizes',
      histograms: [
        {
          xMin: [1, 3, 4],
          xMax: [2, 4, 5],
          counts: [[1, 2, 3]],
        },
        {
          xMin: [1, 3, 4],
          xMax: [2, 4, 5],
          counts: [[4, 5, 6]],
        },
      ],
      expected: {
        xMin: [1, 3, 4],
        xMax: [2, 4, 5],
        counts: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      },
    },
    {
      name: 'two histograms with same bucket sizes but counts in some different buckets',
      histograms: [
        {
          xMin: [1, 3, 4],
          xMax: [2, 4, 5],
          counts: [[1, 2, 3]],
        },
        {
          xMin: [2, 3, 6],
          xMax: [3, 4, 7],
          counts: [[4, 5, 6]],
        },
      ],
      expected: {
        xMin: [1, 2, 3, 4, 6],
        xMax: [2, 3, 4, 5, 7],
        counts: [
          [1, 0, 2, 3, 0],
          [0, 4, 5, 0, 6],
        ],
      },
    },
  ];

  testCases.forEach((tc) => {
    it(tc.name, () => {
      const result = joinHistograms(tc.histograms.map(testHistogramToHistogram));

      expect({
        xMin: result.xMin.values,
        xMax: result.xMax.values,
        counts: result.counts.map((f) => f.values),
      }).toEqual(tc.expected);
    });
  });
});
