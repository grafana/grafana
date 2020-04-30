import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { ReducerID } from '../fieldReducer';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';
import { calculateFieldTransformer, CalculateFieldMode } from './calculateField';
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
          "A {0}": 1,
          "B {1}": 2,
          "C {1}": 3,
          "D {1}": "first",
          "The Total": 6,
          "TheTime": 1000,
        },
        Object {
          "A {0}": 100,
          "B {1}": 200,
          "C {1}": 300,
          "D {1}": "second",
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
          include: 'B',
          reducer: ReducerID.mean,
        },
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
          "Add": 5,
          "TheTime": 1000,
        },
        Object {
          "Add": 500,
          "TheTime": 2000,
        },
      ]
    `);
  });

  it('scale value', () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        mode: CalculateFieldMode.Scale,
        scale: {
          left: 'B',
          operation: BinaryOperationID.Add,
          right: 2,
        },
        replaceFields: true,
      },
    };

    const filtered = transformDataFrame([cfg], [seriesBC])[0];
    const rows = new DataFrameView(filtered).toArray();
    expect(rows).toMatchInlineSnapshot(`
      Array [
        Object {
          "Multiply": 4,
          "TheTime": 1000,
        },
        Object {
          "Multiply": 400,
          "TheTime": 2000,
        },
      ]
    `);
  });
});
