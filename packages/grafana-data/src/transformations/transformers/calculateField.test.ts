import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { ReducerID } from '../fieldReducer';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';
import { calculateFieldTransformer, CalculateFieldMode } from './calculateField';
import { DataFrameView } from '../../dataframe';

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
    { name: 'C', type: FieldType.string, values: ['first', 'second'] },
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
          "C {1}": "first",
          "The Total": 3,
          "TheTime": 1000,
        },
        Object {
          "A {0}": 100,
          "B {1}": 200,
          "C {1}": "second",
          "The Total": 300,
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
          "Mean": 1.5,
          "TheTime": 1000,
        },
        Object {
          "Mean": 150,
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

    const filtered = transformDataFrame([cfg], [seriesA, seriesBC])[0];
    const rows = new DataFrameView(filtered).toArray();
    expect(rows).toMatchInlineSnapshot(`
      Array [
        Object {
          "Mean": null,
          "TheTime": 1000,
        },
        Object {
          "Mean": null,
          "TheTime": 2000,
        },
      ]
    `);
  });
});
