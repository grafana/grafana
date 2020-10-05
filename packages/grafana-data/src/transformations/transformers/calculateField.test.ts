import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { ReducerID } from '../fieldReducer';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';
import { CalculateFieldMode, calculateFieldTransformer, ReduceOptions } from './calculateField';
import { DataFrameView } from '../../dataframe';
import { BinaryOperationID } from '../../utils';
import { observableTester } from '../../utils/tests/observableTester';

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

  it('will filter and alias', done => {
    const cfg = {
      id: DataTransformerID.calculateField,
      options: {
        // defaults to `sum` ReduceRow
        alias: 'The Total',
      },
    };

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesA, seriesBC]),
      expect: data => {
        const filtered = data[0];
        const rows = new DataFrameView(filtered).toArray();
        expect(rows).toEqual([
          {
            A: 1,
            B: 2,
            C: 3,
            D: 'first',
            'The Total': 6,
            TheTime: 1000,
          },
          {
            A: 100,
            B: 200,
            C: 300,
            D: 'second',
            'The Total': 600,
            TheTime: 2000,
          },
        ]);
      },
      done,
    });
  });

  it('will replace other fields', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesA, seriesBC]),
      expect: data => {
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
      },
      done,
    });
  });

  it('will filter by name', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesBC]),
      expect: data => {
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
      },
      done,
    });
  });

  it('binary math', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesBC]),
      expect: data => {
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
      },
      done,
    });
  });

  it('field + static number', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesBC]),
      expect: data => {
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
      },
      done,
    });
  });
});
