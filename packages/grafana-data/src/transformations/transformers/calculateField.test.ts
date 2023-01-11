import { DataFrameView } from '../../dataframe';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { DataTransformContext, ScopedVars } from '../../types';
import { FieldType } from '../../types/dataFrame';
import { BinaryOperationID } from '../../utils';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ReducerID } from '../fieldReducer';
import { transformDataFrame } from '../transformDataFrame';

import { CalculateFieldMode, calculateFieldTransformer, ReduceOptions } from './calculateField';
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
        for (const key of Object.keys(variables)) {
          if (target === `$${key}`) {
            return variables[key].value + '';
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
});
