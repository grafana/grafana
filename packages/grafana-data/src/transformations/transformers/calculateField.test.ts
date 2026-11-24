import { DataFrameView } from '../../dataframe/DataFrameView';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { cacheFieldDisplayNames } from '../../field/fieldState';
import { type DataFrame, FieldType } from '../../types/dataFrame';
import { BinaryOperationID } from '../../utils/binaryOperators';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { UnaryOperationID } from '../../utils/unaryOperators';
import { ReducerID } from '../fieldReducer';
import { FieldMatcherID } from '../matchers/ids';
import { transformDataFrame } from '../transformDataFrame';

import {
  CalculateFieldMode,
  calculateFieldTransformer,
  type CalculateFieldTransformerOptions,
  type ReduceOptions,
  WindowSizeMode,
  WindowAlignment,
  getFieldTemplateReference,
  getNameFromOptions,
  parseFieldTemplate,
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

beforeAll(() => {
  mockTransformationsRegistry([calculateFieldTransformer]);
});

describe('calculateField transformer w/ timeseries', () => {
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

  it("byType/number: don't inherit original field.state in new fields. don't create duplicate fields.", async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.BinaryOperation,
        binary: {
          left: { matcher: { id: FieldMatcherID.byType, options: FieldType.number } },
          operator: BinaryOperationID.Add,
          right: '2',
        },
        replaceFields: false,
      },
    };

    cacheFieldDisplayNames([seriesBC]);

    await expect(transformDataFrame([cfg], [seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];

      expect(filtered).toEqual({
        fields: [
          {
            name: 'TheTime',
            type: 'time',
            values: [1000, 2000],
            config: {},
            state: { displayName: 'TheTime', multipleFrames: false },
          },
          {
            name: 'B',
            type: 'number',
            values: [2, 200],
            config: {},
            state: { displayName: 'B', multipleFrames: false },
          },
          { name: 'B + 2', type: 'number', values: [4, 202], config: {} },
          {
            name: 'C',
            type: 'number',
            values: [3, 300],
            config: {},
            state: { displayName: 'C', multipleFrames: false },
          },
          { name: 'C + 2', type: 'number', values: [5, 302], config: {} },
          {
            name: 'D',
            type: 'string',
            values: ['first', 'second'],
            config: {},
            state: { displayName: 'D', multipleFrames: false },
          },
          {
            name: 'E',
            type: 'boolean',
            values: [true, false],
            config: {},
            state: { displayName: 'E', multipleFrames: false },
          },
        ],
        length: 2,
      });
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
      expect(data).toEqual([
        {
          fields: [
            {
              config: {},
              name: 'TheTime',
              state: {
                displayName: 'TheTime',
                multipleFrames: true,
              },
              type: 'time',
              values: [1000, 2000],
            },
            {
              config: {},
              name: 'B + 2',
              type: 'number',
              values: [4, 202],
            },
          ],
          length: 2,
        },
      ]);
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

      expect(data).toEqual([
        {
          fields: [
            {
              config: {},
              name: 'TheTime',
              type: 'time',
              values: [1000, 2000],
            },
            {
              config: {},
              name: 'A + 2',
              type: 'number',
              values: [3, 102],
            },
          ],
          length: 2,
        },
        {
          fields: [
            {
              config: {},
              name: 'TheTime',
              type: 'time',
              values: [1000, 2000],
            },
            {
              config: {},
              name: 'B + 2',
              type: 'number',
              values: [4, 202],
            },
            {
              config: {},
              name: 'C + 2',
              type: 'number',
              values: [5, 302],
            },
          ],
          length: 2,
        },
      ]);
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

  describe('unary math', () => {
    it('calculates absolute value accurately', async () => {
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

    it('calculates percentage value accurately', async () => {
      const testCases = [
        {
          values: [1, 2, 3, 4],
          result: [0.1, 0.2, 0.3, 0.4],
        },
        {
          values: [1, 0, 5, 4],
          result: [0.1, 0, 0.5, 0.4],
        },
        {
          values: [1, Infinity, 5, 4],
          result: [0.1, Infinity, 0.5, 0.4],
        },
        {
          values: [0, 0, 0, 0],
          result: [0, 0, 0, 0],
        },
        {
          values: ['a', 's', 2, 4],
          result: [NaN, NaN, 0.3333333333333333, 0.6666666666666666],
        },
        {
          values: [1e5, 1, 2, 4],
          result: [0.999930004899657, 0.000009999300048996571, 0.000019998600097993142, 0.000039997200195986284],
        },
      ];

      const cfg = {
        id: DataTransformerID.calculateField,
        options: {
          mode: CalculateFieldMode.UnaryOperation,
          unary: {
            fieldName: 'A',
            operator: UnaryOperationID.Percent,
          },
          replaceFields: true,
        },
      };

      testCases.forEach(async (testCase) => {
        const unarySeries = toDataFrame({
          fields: [
            { name: 'TheTime', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'A', type: FieldType.number, values: testCase.values },
          ],
        });

        await expect(transformDataFrame([cfg], [unarySeries])).toEmitValuesWith((received) => {
          const data = received[0];
          const filtered = data[0];
          const rows = new DataFrameView(filtered).toArray();
          expect(rows).toEqual([
            {
              'percent(A)': testCase.result[0],
              TheTime: 1000,
            },
            {
              'percent(A)': testCase.result[1],
              TheTime: 2000,
            },
            {
              'percent(A)': testCase.result[2],
              TheTime: 3000,
            },
            {
              'percent(A)': testCase.result[3],
              TheTime: 4000,
            },
          ]);
        });
      });
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
      expect(rows).toEqual([
        {
          'E * 1': 1,
          TheTime: 1000,
        },
        {
          'E * 1': 0,
          TheTime: 2000,
        },
      ]);
    });
  });

  it('transforms multiple queries + field + field in the old format', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        binary: {
          left: 'A',
          operator: '+',
          reducer: 'sum',
          right: 'B',
        },
        mode: CalculateFieldMode.BinaryOperation,
        reduce: {
          reducer: 'sum',
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesA, seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      expect(data).toEqual([
        {
          fields: [
            {
              config: {},
              name: 'TheTime',
              state: {
                displayName: 'TheTime',
                multipleFrames: false,
              },
              type: 'time',
              values: [1000, 2000],
            },
            {
              config: {},
              name: 'A + B',
              type: 'number',
              values: [3, 300],
            },
          ],
          length: 2,
          refId: 'joinByField--',
        },
      ]);
    });
  });

  it('transforms multiple queries + field + field in the old format (non existent right field)', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        binary: {
          left: 'A',
          operator: '+',
          reducer: 'sum',
          right: 'Z',
        },
        mode: CalculateFieldMode.BinaryOperation,
        reduce: {
          reducer: 'sum',
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesA, seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      expect(data).toEqual([]);
    });
  });

  it('transforms multiple queries + field + number in the old format and does not join', async () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        binary: {
          left: 'A',
          operator: '+',
          reducer: 'sum',
          right: '1336',
        },
        mode: CalculateFieldMode.BinaryOperation,
        reduce: {
          reducer: 'sum',
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesA, seriesBC])).toEmitValuesWith((received) => {
      const data = received[0];
      expect(data).toEqual([
        {
          fields: [
            {
              config: {},
              name: 'TheTime',
              state: {
                displayName: 'TheTime',
                multipleFrames: true,
              },
              type: 'time',
              values: [1000, 2000],
            },
            {
              config: {},
              name: 'A + 1336',
              type: 'number',
              values: [1337, 1436],
            },
          ],
          length: 2,
        },
      ]);
    });
  });

  it('when alias exists sets displayName = alias to prevent downstream auto-naming', async () => {
    const seriesA = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'A', type: FieldType.number, values: [1, 2] },
      ],
    });

    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        alias: 'Aye',
        binary: {
          left: 'A',
          operator: '+',
          reducer: 'sum',
          right: '10',
        },
        mode: CalculateFieldMode.BinaryOperation,
        reduce: {
          reducer: 'sum',
        },
        replaceFields: true,
      },
    };

    await expect(transformDataFrame([cfg], [seriesA])).toEmitValuesWith((received) => {
      const data = received[0];
      expect(data).toEqual([
        {
          fields: [
            {
              config: {},
              name: 'time',
              state: {
                displayName: 'time',
                multipleFrames: false,
              },
              type: 'time',
              values: [1000, 2000],
            },
            {
              config: {
                displayName: 'Aye',
              },
              name: 'Aye',
              type: 'number',
              values: [11, 12],
            },
          ],
          length: 2,
        },
      ]);
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

describe('calculateField transformer template mode', () => {
  const runTemplate = async (
    template: string,
    frames: DataFrame[],
    extra: Partial<CalculateFieldTransformerOptions> = {}
  ): Promise<DataFrame[]> => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: { mode: CalculateFieldMode.Template, template: { template }, ...extra },
    };
    let result: DataFrame[] = [];
    await expect(transformDataFrame([cfg], frames)).toEmitValuesWith((received) => {
      result = received[0];
    });
    return result;
  };

  const issueFrame = toDataFrame({
    fields: [
      { name: 'test1', type: FieldType.string, values: ['alpha', 'beta'] },
      { name: 'test2', type: FieldType.string, values: ['apple', 'banana'] },
      { name: 'test3', type: FieldType.number, values: [1, 2] },
    ],
  });

  it('builds a string field from field references and literal text', async () => {
    const [frame] = await runTemplate('${__data.fields.test2} (${__data.fields.test1}): ${__data.fields.test3}', [
      issueFrame,
    ]);

    const output = frame.fields[3];
    expect(output.name).toBe('Template');
    expect(output.type).toBe(FieldType.string);
    expect(output.values).toEqual(['apple (alpha): 1', 'banana (beta): 2']);
  });

  it('resolves bracket references to names with dots and spaces', async () => {
    const frame = toDataFrame({
      fields: [
        { name: 'host.name', type: FieldType.string, values: ['web-1'] },
        { name: 'status code', type: FieldType.number, values: [404] },
      ],
    });

    const [result] = await runTemplate(`\${__data.fields["host.name"]} \${__data.fields['status code']}`, [frame]);

    expect(result.fields[2].values).toEqual(['web-1 404']);
  });

  it('formats numbers with automatic decimals and with the field unit and decimals config', async () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Min', type: FieldType.number, values: [26.631780466] },
        { name: 'Max', type: FieldType.number, values: [-6.789123] },
        { name: 'Load', type: FieldType.number, values: [12.345], config: { unit: 'percent', decimals: 1 } },
      ],
    });

    const [result] = await runTemplate('${__data.fields.Min} : ${__data.fields.Max} (${__data.fields.Load})', [frame]);

    expect(result.fields[3].values).toEqual(['26.6 : -6.79 (12.3%)']);
  });

  it('applies the template decimals to every number, over the field decimals config', async () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Min', type: FieldType.number, values: [26.631780466] },
        { name: 'Load', type: FieldType.number, values: [12.345], config: { unit: 'percent', decimals: 1 } },
      ],
    });
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.Template,
        template: { template: '${__data.fields.Min} (${__data.fields.Load})', decimals: 3 },
      },
    };

    await expect(transformDataFrame([cfg], [frame])).toEmitValuesWith((received) => {
      expect(received[0][0].fields[2].values).toEqual(['26.632 (12.345%)']);
    });
  });

  it('renders null and undefined values as empty strings', async () => {
    const frame = toDataFrame({
      fields: [{ name: 'host', type: FieldType.string, values: ['a', null, undefined] }],
    });

    const [result] = await runTemplate('[${__data.fields.host}]', [frame]);

    expect(result.fields[1].values).toEqual(['[a]', '[]', '[]']);
  });

  it('renders a reference to a missing field as an empty string', async () => {
    const [frame] = await runTemplate('${__data.fields.test1}-${__data.fields.missing}', [issueFrame]);

    expect(frame.fields[3].values).toEqual(['alpha-', 'beta-']);
  });

  it('adds a constant column for a template without field references', async () => {
    const [frame] = await runTemplate('static text', [issueFrame]);

    expect(frame.fields[3].values).toEqual(['static text', 'static text']);
  });

  it('leaves a frame unchanged when none of its references resolve', async () => {
    const [frame] = await runTemplate('${__data.fields.missing}', [issueFrame]);

    expect(frame.fields.map((f) => f.name)).toEqual(['test1', 'test2', 'test3']);
  });

  it('resolves a reference by display name', async () => {
    const frame = toDataFrame({
      fields: [{ name: 'Value', type: FieldType.number, values: [7], config: { displayName: 'Speed' } }],
    });

    const [result] = await runTemplate('${__data.fields.Speed} km/h', [frame]);

    expect(result.fields[1].values).toEqual(['7 km/h']);
  });

  it('keeps literal dollar text and unsupported references as written', async () => {
    const [frame] = await runTemplate('$5 ${__data.fields.test1.numeric} ${__data.fields.test1}', [issueFrame]);

    expect(frame.fields[3].values).toEqual([
      '$5 ${__data.fields.test1.numeric} alpha',
      '$5 ${__data.fields.test1.numeric} beta',
    ]);
  });

  it('uses the alias as name and replaces other fields when configured', async () => {
    const [frame] = await runTemplate('${__data.fields.test1}/${__data.fields.test3}', [issueFrame], {
      alias: 'Label',
      replaceFields: true,
    });

    expect(frame.fields).toHaveLength(1);
    expect(frame.fields[0].name).toBe('Label');
    expect(frame.fields[0].values).toEqual(['alpha/1', 'beta/2']);
  });

  it('keeps the time field when replacing fields on a time series', async () => {
    const [frame] = await runTemplate('${__data.fields.D}', [seriesBC], { replaceFields: true });

    expect(frame.fields.map((f) => f.name)).toEqual(['TheTime', 'Template']);
    expect(frame.fields[1].values).toEqual(['first', 'second']);
  });
});

describe('parseFieldTemplate', () => {
  it('splits a template into literal text and field references', () => {
    expect(parseFieldTemplate('a ${__data.fields.x} b ${__data.fields["y.z"]}')).toEqual([
      { text: 'a ' },
      { field: 'x' },
      { text: ' b ' },
      { field: 'y.z' },
    ]);
  });
});

describe('getFieldTemplateReference', () => {
  it.each([
    { name: 'host', expected: '${__data.fields.host}' },
    { name: 'host.name', expected: '${__data.fields["host.name"]}' },
    { name: 'say "hi"', expected: `\${__data.fields['say "hi"']}` },
  ])('builds $expected for $name', ({ name, expected }) => {
    expect(getFieldTemplateReference(name)).toBe(expected);
  });
});

describe('getNameFromOptions', () => {
  it('returns alias when provided', () => {
    const options = {
      mode: CalculateFieldMode.ReduceRow,
      alias: 'My Custom Name',
      reduce: { reducer: ReducerID.sum },
    };
    expect(getNameFromOptions(options)).toBe('My Custom Name');
  });

  it('returns cumulative function name', () => {
    const options = {
      mode: CalculateFieldMode.CumulativeFunctions,
      cumulative: { reducer: ReducerID.sum, field: 'Value' },
    };
    expect(getNameFromOptions(options)).toBe('cumulative sum(Value)');
  });

  it('returns cumulative function name without field', () => {
    const options = {
      mode: CalculateFieldMode.CumulativeFunctions,
      cumulative: { reducer: ReducerID.mean },
    };
    expect(getNameFromOptions(options)).toBe('cumulative mean');
  });

  it('returns window function name', () => {
    const options = {
      mode: CalculateFieldMode.WindowFunctions,
      window: {
        windowAlignment: WindowAlignment.Trailing,
        reducer: ReducerID.mean,
        field: 'Temperature',
      },
    };
    expect(getNameFromOptions(options)).toBe('trailing moving mean(Temperature)');
  });

  it('returns window function name without field', () => {
    const options = {
      mode: CalculateFieldMode.WindowFunctions,
      window: {
        windowAlignment: WindowAlignment.Centered,
        reducer: ReducerID.sum,
      },
    };
    expect(getNameFromOptions(options)).toBe('centered moving sum');
  });

  it('returns unary operation name', () => {
    const options = {
      mode: CalculateFieldMode.UnaryOperation,
      unary: {
        operator: UnaryOperationID.Abs,
        fieldName: 'Value',
      },
    };
    expect(getNameFromOptions(options)).toBe('abs(Value)');
  });

  it('returns unary operation name without field', () => {
    const options = {
      mode: CalculateFieldMode.UnaryOperation,
      unary: {
        operator: UnaryOperationID.Abs,
        fieldName: '',
      },
    };
    expect(getNameFromOptions(options)).toBe('abs');
  });

  it('returns binary operation name with field matcher', () => {
    const options = {
      mode: CalculateFieldMode.BinaryOperation,
      binary: {
        left: { matcher: { id: FieldMatcherID.byName, options: 'FieldA' } },
        operator: BinaryOperationID.Add,
        right: { matcher: { id: FieldMatcherID.byName, options: 'FieldB' } },
      },
    };
    expect(getNameFromOptions(options)).toBe('FieldA + FieldB');
  });

  it('returns binary operation name with fixed values', () => {
    const options = {
      mode: CalculateFieldMode.BinaryOperation,
      binary: {
        left: { fixed: '10' },
        operator: BinaryOperationID.Multiply,
        right: { fixed: '5' },
      },
    };
    expect(getNameFromOptions(options)).toBe('10 * 5');
  });

  it('returns empty string for binary operation with variables', () => {
    const options = {
      mode: CalculateFieldMode.BinaryOperation,
      binary: {
        left: { fixed: '$variable1' },
        operator: BinaryOperationID.Add,
        right: { fixed: '10' },
      },
    };
    expect(getNameFromOptions(options)).toBe('');
  });

  it('returns empty string when binary field is not provided', () => {
    const options = {
      mode: CalculateFieldMode.BinaryOperation,
      // No binary field provided at all
    };
    expect(getNameFromOptions(options)).toBe('');
  });

  it('returns reducer name for reduce row mode', () => {
    const options = {
      mode: CalculateFieldMode.ReduceRow,
      reduce: { reducer: ReducerID.mean },
    };
    expect(getNameFromOptions(options)).toBe('Mean');
  });

  it('returns "Row" for index mode', () => {
    const options = {
      mode: CalculateFieldMode.Index,
    };
    expect(getNameFromOptions(options)).toBe('Row');
  });

  it('returns "math" as default', () => {
    const options = {
      mode: 'invalid-mode' as CalculateFieldMode,
    };
    expect(getNameFromOptions(options)).toBe('math');
  });
});
