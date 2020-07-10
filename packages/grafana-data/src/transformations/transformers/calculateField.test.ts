import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { ReducerID } from '../fieldReducer';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';
import { calculateFieldTransformer, CalculateFieldMode, ReduceOptions } from './calculateField';
import { DataFrameView } from '../../dataframe';
import { BinaryOperationID } from '../../utils';

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

describe('calculateField transformer w/ timeseries', () => {
  beforeAll(() => {
    mockTransformationsRegistry([calculateFieldTransformer]);
  });

  it('will filter and alias', () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        // defaults to `sum` ReduceRow
        alias: 'The Total',
      },
    };

    const filtered = transformDataFrame([cfg], [seriesA, seriesBC])[0];
    const rows = new DataFrameView(filtered).toArray();
    expect(rows).toMatchInlineSnapshot(`
      Array [
        Object {
          "A": 1,
          "B": 2,
          "C": 3,
          "D": "first",
          "The Total": 6,
          "TheTime": 1000,
        },
        Object {
          "A": 100,
          "B": 200,
          "C": 300,
          "D": "second",
          "The Total": 600,
          "TheTime": 2000,
        },
      ]
    `);
  });

  it('will replace other fields', () => {
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

    const filtered = transformDataFrame([cfg], [seriesA, seriesBC])[0];
    const rows = new DataFrameView(filtered).toArray();
    expect(rows).toMatchInlineSnapshot(`
      Array [
        Object {
          "Mean": 2,
          "TheTime": 1000,
        },
        Object {
          "Mean": 200,
          "TheTime": 2000,
        },
      ]
    `);
  });

  it('will filter by name', () => {
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

    const filtered = transformDataFrame([cfg], [seriesBC])[0];
    const rows = new DataFrameView(filtered).toArray();
    expect(rows).toMatchInlineSnapshot(`
      Array [
        Object {
          "Mean": 2,
          "TheTime": 1000,
        },
        Object {
          "Mean": 200,
          "TheTime": 2000,
        },
      ]
    `);
  });

  it('binary math', () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.BinaryOperation,
        binary: {
          left: 'B',
          operation: BinaryOperationID.Add,
          right: 'C',
        },
        replaceFields: true,
      },
    };

    const filtered = transformDataFrame([cfg], [seriesBC])[0];
    const rows = new DataFrameView(filtered).toArray();
    expect(rows).toMatchInlineSnapshot(`
      Array [
        Object {
          "B + C": 5,
          "TheTime": 1000,
        },
        Object {
          "B + C": 500,
          "TheTime": 2000,
        },
      ]
    `);
  });

  it('field + static number', () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.BinaryOperation,
        binary: {
          left: 'B',
          operation: BinaryOperationID.Add,
          right: '2',
        },
        replaceFields: true,
      },
    };

    const filtered = transformDataFrame([cfg], [seriesBC])[0];
    const rows = new DataFrameView(filtered).toArray();
    expect(rows).toMatchInlineSnapshot(`
      Array [
        Object {
          "B + 2": 4,
          "TheTime": 1000,
        },
        Object {
          "B + 2": 202,
          "TheTime": 2000,
        },
      ]
    `);
  });
});
