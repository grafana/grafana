import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { ReducerID } from '../fieldReducer';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';
import { calculateFieldTransformer } from './calculateField';
import { DataFrameView } from '../../dataframe';

const seriesToTestWith = toDataFrame({
  fields: [
    { name: 'A', type: FieldType.time, values: [1000, 2000] },
    { name: 'B', type: FieldType.number, values: [1, 100] },
    { name: 'C', type: FieldType.number, values: [2, 200] },
    { name: 'D', type: FieldType.string, values: ['first', 'second'] },
  ],
});

describe('calculateField transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([calculateFieldTransformer]);
  });

  it('will filter and alias', () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        // defautls to sum
        alias: 'The Total',
      },
    };

    const filtered = transformDataFrame([cfg], [seriesToTestWith])[0];
    const rows = new DataFrameView(filtered).toArray();
    expect(rows).toMatchInlineSnapshot(`
      Array [
        Object {
          "A": 1000,
          "B": 1,
          "C": 2,
          "D": "first",
          "The Total": 3,
        },
        Object {
          "A": 2000,
          "B": 100,
          "C": 200,
          "D": "second",
          "The Total": 300,
        },
      ]
    `);
  });

  it('will replace other fields', () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        reducer: ReducerID.mean,
        replaceFields: true,
      },
    };

    const filtered = transformDataFrame([cfg], [seriesToTestWith])[0];
    const rows = new DataFrameView(filtered).toArray();
    expect(rows).toMatchInlineSnapshot(`
      Array [
        Object {
          "Mean": 1.5,
        },
        Object {
          "Mean": 150,
        },
      ]
    `);
  });

  it('will filter by name', () => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        reducer: ReducerID.mean,
        replaceFields: true,
        include: 'B',
      },
    };

    const filtered = transformDataFrame([cfg], [seriesToTestWith])[0];
    const rows = new DataFrameView(filtered).toArray();
    expect(rows).toMatchInlineSnapshot(`
      Array [
        Object {
          "Mean": 1,
        },
        Object {
          "Mean": 100,
        },
      ]
    `);
  });
});
