import { DataFrameView } from '../../dataframe/DataFrameView';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { ScopedVars } from '../../types/ScopedVars';
import { FieldType } from '../../types/dataFrame';
import { DataTransformContext } from '../../types/transformations';
import { BinaryOperationID } from '../../utils/binaryOperators';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { UnaryOperationID } from '../../utils/unaryOperators';
import { ReducerID } from '../fieldReducer';
import { FieldMatcherID } from '../matchers/ids';
import { transformDataFrame } from '../transformDataFrame';

import {
  CalculateFieldMode,
  calculateFieldTransformer,
  ReduceOptions,
  WindowSizeMode,
  WindowAlignment,
} from './calculateField';
import { DataTransformerID } from './ids';

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
    { name: 'E', type: FieldType.boolean, values: [true, false] },
  ],
});

describe('calculateField transformer w/ timeseries', () => {
  beforeAll(() => {
    mockTransformationsRegistry([calculateFieldTransformer]);
  });

  beforeEach(() => {
    seriesA.fields.forEach((f) => {
      delete f.state;
    });
    seriesBC.fields.forEach((f) => {
      delete f.state;
    });
  });

  it('will filter and alias', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        // defaults to `sum` ReduceRow
        alias: 'The Total',
      },
    };

    await expect(transformDataFrame([cfg], [seriesA, seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      const rows = new DataFrameView(filtered).toArray();
      expect(rows).toEqual([
        {
          A: 1,
          B: 2,
          C: 3,
          D: 'first',
          E: true,
          'The Total': 6,
          TheTime: 1000,
        },
        {
          A: 100,
          B: 200,
          C: 300,
          D: 'second',
          E: false,
          'The Total': 600,
          TheTime: 2000,
        },
      ]);
    });
  });

  it('will replace other fields', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.ReduceRow,
        reduce: {
          reducer: ReducerID.mean,
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesA, seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      const rows = new DataFrameView(filtered).toArray();
      expect(rows).toEqual([
        {
          Mean: 2,
          TheTime: 1000,
        },
        {
          Mean: 200,
          TheTime: 2000,
        },
      ]);
    });
  });

  it('will filter by name', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.ReduceRow,
        reduce: {
          include: ['B'],
          reducer: ReducerID.mean,
        } as ReduceOptions,
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      const rows = new DataFrameView(filtered).toArray();
      expect(rows).toEqual([
        {
          Mean: 2,
          TheTime: 1000,
        },
        {
          Mean: 200,
          TheTime: 2000,
        },
      ]);
    });
  });

  it('binary math', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.BinaryOperation,
        binary: {
          left: 'B',
          operator: BinaryOperationID.Add,
          right: 'C',
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      const rows = new DataFrameView(filtered).toArray();
      expect(rows).toEqual([
        {
          'B + C': 5,
          TheTime: 1000,
        },
        {
          'B + C': 500,
          TheTime: 2000,
        },
      ]);
    });
  });

  it('field + static number', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.BinaryOperation,
        binary: {
          left: 'B',
          operator: BinaryOperationID.Add,
          right: '2',
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      const rows = new DataFrameView(filtered).toArray();
      expect(rows).toEqual([
        {
          'B + 2': 4,
          TheTime: 1000,
        },
        {
          'B + 2': 202,
          TheTime: 2000,
        },
      ]);
    });
  });

  it('multiple queries + field + static number', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.BinaryOperation,
        binary: {
          left: 'B',
          operator: BinaryOperationID.Add,
          right: '2',
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesA, seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      expect(data).toMatchInlineSnapshot(`
        [
          {
            "fields": [
              {
                "config": {},
                "name": "TheTime",
                "state": {
                  "displayName": "TheTime",
                  "multipleFrames": true,
                },
                "type": "time",
                "values": [
                  1000,
                  2000,
                ],
              },
              {
                "config": {},
                "name": "B + 2",
                "type": "number",
                "values": [
                  4,
                  202,
                ],
              },
            ],
            "length": 2,
          },
        ]
      `);
    });
  });

  it('all numbers + static number', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.BinaryOperation,
        binary: {
          left: { matcher: { id: FieldMatcherID.byType, options: FieldType.number } },
          operator: BinaryOperationID.Add,
          right: '2',
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      const rows = new DataFrameView(filtered).toArray();
      expect(rows).toEqual([
        {
          'B + 2': 4,
          'C + 2': 5,
          TheTime: 1000,
        },
        {
          'B + 2': 202,
          'C + 2': 302,
          TheTime: 2000,
        },
      ]);
    });
  });

  it('all numbers + static number (multi-frame, avoids join)', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.BinaryOperation,
        binary: {
          left: { matcher: { id: FieldMatcherID.byType, options: FieldType.number } },
          operator: BinaryOperationID.Add,
          right: '2',
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesA, seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];

      expect(data).toMatchInlineSnapshot(`
        [
          {
            "fields": [
              {
                "config": {},
                "name": "TheTime",
                "type": "time",
                "values": [
                  1000,
                  2000,
                ],
              },
              {
                "config": {},
                "name": "A + 2",
                "type": "number",
                "values": [
                  3,
                  102,
                ],
              },
            ],
            "length": 2,
          },
          {
            "fields": [
              {
                "config": {},
                "name": "TheTime",
                "type": "time",
                "values": [
                  1000,
                  2000,
                ],
              },
              {
                "config": {},
                "name": "B + 2",
                "type": "number",
                "values": [
                  4,
                  202,
                ],
              },
              {
                "config": {},
                "name": "C + 2",
                "type": "number",
                "values": [
                  5,
                  302,
                ],
              },
            ],
            "length": 2,
          },
        ]
      `);
    });
  });

  it('all numbers + field number', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.BinaryOperation,
        binary: {
          left: { matcher: { id: FieldMatcherID.byType, options: FieldType.number } },
          operator: BinaryOperationID.Add,
          right: 'C',
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      const rows = new DataFrameView(filtered).toArray();
      expect(rows).toEqual([
        {
          'B + C': 5,
          'C + C': 6,
          TheTime: 1000,
        },
        {
          'B + C': 500,
          'C + C': 600,
          TheTime: 2000,
        },
      ]);
    });
  });

  it('unary math', async () => {
    const unarySeries = toDataFrame({
      fields: [
        { name: 'TheTime', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
        { name: 'A', type: FieldType.number, values: [1, -10, -200, 300] },
      ],
    });

    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.UnaryOperation,
        unary: {
          fieldName: 'A',
          operator: UnaryOperationID.Abs,
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [unarySeries])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      const rows = new DataFrameView(filtered).toArray();
      expect(rows).toEqual([
        {
          'abs(A)': 1,
          TheTime: 1000,
        },
        {
          'abs(A)': 10,
          TheTime: 2000,
        },
        {
          'abs(A)': 200,
          TheTime: 3000,
        },
        {
          'abs(A)': 300,
          TheTime: 4000,
        },
      ]);
    });
  });

  it('boolean field', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.BinaryOperation,
        binary: {
          left: 'E',
          operator: BinaryOperationID.Multiply,
          right: '1',
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      const rows = new DataFrameView(filtered).toArray();
      expect(rows).toMatchInlineSnapshot(`
        [
          {
            "E * 1": 1,
            "TheTime": 1000,
          },
          {
            "E * 1": 0,
            "TheTime": 2000,
          },
        ]
      `);
    });
  });

  it('reduces all field', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.ReduceRow,
        reduce: { include: ['B', 'C'], reducer: ReducerID.allValues },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      const rows = new DataFrameView(filtered).toArray();
      expect(rows).toEqual([
        {
          'All values': [2, 3],
          TheTime: 1000,
        },
        {
          'All values': [200, 300],
          TheTime: 2000,
        },
      ]);
    });
  });

  it('can add index field', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.Index,
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesBC])).toEmitValuesWith((received) => {
      const data = received[0][0];
      expect(data.fields.length).toEqual(1);
      expect(data.fields[0].values).toEqual([0, 1]);
    });
  });

  it('can add percentage index field', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.Index,
        replaceFields: true,
        index: {
          asPercentile: true,
        },
      },
    };

    const series = toDataFrame({
      fields: [
        { name: 'TheTime', type: FieldType.time, values: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000] },
        { name: 'Field', type: FieldType.number, values: [2, 200, 3, 6, 3, 7, 9, 9] },
      ],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];
      expect(data.fields.length).toEqual(1);
      expect(data.fields[0].values[2]).toEqual(0.25);
      expect(data.fields[0].values[4]).toEqual(0.5);
      expect(data.fields[0].values[6]).toEqual(0.75);
    });
  });

  it('uses template variable substituion', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        alias: '$var1',
        mode: CalculateFieldMode.BinaryOperation,
        binary: {
          left: 'A',
          operator: BinaryOperationID.Add,
          right: '$var2',
        },
        replaceFields: true,
      },
    };
    const context: DataTransformContext = {
      interpolate: (target: string | undefined, scopedVars?: ScopedVars, format?: string | Function): string => {
        if (!target) {
          return '';
        }
        const variables: ScopedVars = {
          var1: {
            value: 'Test',
            text: 'Test',
          },
          var2: {
            value: 5,
            text: '5',
          },
          __interval: {
            value: 10000,
            text: '10000',
          },
        };
        for (const key in variables) {
          if (target === `$${key}`) {
            return variables[key]!.value + '';
          }
        }
        return target;
      },
    };

    await expect(transformDataFrame([cfg], [seriesA], context)).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      const rows = new DataFrameView(filtered).toArray();
      expect(rows).toMatchInlineSnapshot(`
        [
          {
            "Test": 6,
            "TheTime": 1000,
          },
          {
            "Test": 105,
            "TheTime": 2000,
          },
        ]
      `);
    });
  });

  it('calculates centered moving average on odd window size', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Centered,
          field: 'x',
          windowSize: 1,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.mean,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(1.5);
      expect(data.fields[1].values[1]).toEqual(2);
      expect(data.fields[1].values[2]).toEqual(2.5);
    });
  });

  it('calculates centered moving average on even window size', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Centered,
          field: 'x',
          windowSize: 0.5,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.mean,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(1);
      expect(data.fields[1].values[1]).toEqual(1.5);
      expect(data.fields[1].values[2]).toEqual(2.5);
    });
  });

  it('calculates centered moving average when window size larger than dataset', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Centered,
          field: 'x',
          windowSize: 5,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.mean,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(2);
      expect(data.fields[1].values[1]).toEqual(2);
      expect(data.fields[1].values[2]).toEqual(2);
    });
  });

  it('calculates trailing moving average', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Trailing,
          field: 'x',
          windowSize: 1,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.mean,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(1);
      expect(data.fields[1].values[1]).toEqual(1.5);
      expect(data.fields[1].values[2]).toEqual(2);
    });
  });

  it('calculates fixed, trailing moving average with missing values', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Trailing,
          field: 'x',
          windowSize: 2,
          windowSizeMode: WindowSizeMode.Fixed,
          reducer: ReducerID.mean,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, undefined, 3, 4, 5] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      //console.log(data.fields);

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values).toEqual([1, 1, 3, 3.5, 4.5]);
    });
  });

  it('throws error when calculating moving average if window size < 1', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Trailing,
          field: 'x',
          windowSize: 0,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.mean,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const err = new Error('Add field from calculation transformation - Window size must be larger than 0');
      expect(received[0]).toEqual(err);
    });
  });

  it('calculates cumulative total', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.CumulativeFunctions,
        cumulative: {
          field: 'x',
          reducer: ReducerID.sum,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(1);
      expect(data.fields[1].values[1]).toEqual(3);
      expect(data.fields[1].values[2]).toEqual(6);
    });
  });

  it('calculates cumulative mean', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.CumulativeFunctions,
        cumulative: {
          field: 'x',
          reducer: ReducerID.mean,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(1);
      expect(data.fields[1].values[1]).toEqual(1.5);
      expect(data.fields[1].values[2]).toEqual(2);
    });
  });
  it('calculates cumulative total with undefined values', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.CumulativeFunctions,
        cumulative: {
          field: 'x',
          reducer: ReducerID.sum,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, undefined, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(1);
      expect(data.fields[1].values[1]).toEqual(1);
      expect(data.fields[1].values[2]).toEqual(3);
      expect(data.fields[1].values[3]).toEqual(6);
    });
  });

  it('calculates cumulative total with nulls', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.CumulativeFunctions,
        cumulative: {
          field: 'x',
          reducer: ReducerID.sum,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, null, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(1);
      expect(data.fields[1].values[1]).toEqual(1);
      expect(data.fields[1].values[2]).toEqual(3);
      expect(data.fields[1].values[3]).toEqual(6);
    });
  });

  it('calculates trailing moving average with nulls', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Trailing,
          field: 'x',
          windowSize: 0.75,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.mean,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, null, 2, 7] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(1);
      expect(data.fields[1].values[1]).toEqual(1);
      expect(data.fields[1].values[2]).toEqual(1.5);
      expect(data.fields[1].values[3]).toEqual(4.5);
    });
  });

  it('calculates trailing moving variance', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Trailing,
          field: 'x',
          windowSize: 1,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.variance,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(0);
      expect(data.fields[1].values[1]).toEqual(0.25);
      expect(data.fields[1].values[2]).toBeCloseTo(0.6666666, 4);
    });
  });

  it('calculates centered moving stddev', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Centered,
          field: 'x',
          windowSize: 1,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.stdDev,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(0.5);
      expect(data.fields[1].values[1]).toBeCloseTo(0.8164, 2);
      expect(data.fields[1].values[2]).toEqual(0.5);
    });
  });

  it('calculates centered moving stddev with null', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Centered,
          field: 'x',
          windowSize: 0.75,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.stdDev,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, null, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(0);
      expect(data.fields[1].values[1]).toEqual(0.5);
      expect(data.fields[1].values[2]).toEqual(0.5);
      expect(data.fields[1].values[3]).toEqual(0.5);
    });
  });

  it('calculates centered moving average with undefined values', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Centered,
          field: 'x',
          windowSize: 0.75,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.mean,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, undefined, 2, 7] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(1);
      expect(data.fields[1].values[1]).toEqual(1.5);
      expect(data.fields[1].values[2]).toEqual(4.5);
      expect(data.fields[1].values[3]).toEqual(4.5);
    });
  });

  it('calculates centered moving average with nulls', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Centered,
          field: 'x',
          windowSize: 0.75,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.mean,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, null, 2, 7] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(1);
      expect(data.fields[1].values[1]).toEqual(1.5);
      expect(data.fields[1].values[2]).toEqual(4.5);
      expect(data.fields[1].values[3]).toEqual(4.5);
    });
  });

  it('calculates centered moving average with only nulls', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Centered,
          field: 'x',
          windowSize: 0.75,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.mean,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [null, null, null, null] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(0);
      expect(data.fields[1].values[1]).toEqual(0);
      expect(data.fields[1].values[2]).toEqual(0);
      expect(data.fields[1].values[3]).toEqual(0);
    });
  });

  it('calculates centered moving average with 4 values', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Centered,
          field: 'x',
          windowSize: 0.75,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.mean,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3, 4] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(1.5);
      expect(data.fields[1].values[1]).toEqual(2);
      expect(data.fields[1].values[2]).toEqual(3);
      expect(data.fields[1].values[3]).toEqual(3.5);
    });
  });

  it('calculates trailing moving variance with null in the middle', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Trailing,
          field: 'x',
          windowSize: 0.75,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.variance,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, null, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(0);
      expect(data.fields[1].values[1]).toEqual(0);
      expect(data.fields[1].values[2]).toEqual(0.25);
      expect(data.fields[1].values[3]).toEqual(0.25);
    });
  });

  it('calculates trailing moving variance with null in position 0', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.WindowFunctions,
        window: {
          windowAlignment: WindowAlignment.Trailing,
          field: 'x',
          windowSize: 0.75,
          windowSizeMode: WindowSizeMode.Percentage,
          reducer: ReducerID.variance,
        },
      },
    };

    const series = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [null, 1, 2, 3] }],
    });

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0][0];

      expect(data.fields.length).toEqual(2);
      expect(data.fields[1].values[0]).toEqual(0);
      expect(data.fields[1].values[1]).toEqual(0);
      expect(data.fields[1].values[2]).toEqual(0.25);
      expect(data.fields[1].values[3]).toBeCloseTo(0.6666666, 4);
    });
  });
});
