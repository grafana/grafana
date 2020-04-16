import { ReducerID } from '../fieldReducer';
import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { reduceTransformer } from './reduce';
import { transformDataFrame } from '../transformDataFrame';
import { Field, FieldType } from '../../types';
import { ArrayVector } from '../../vector';

const seriesAWithSingleField = toDataFrame({
  name: 'A',
  fields: [
    { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
    { name: 'temperature', type: FieldType.number, values: [3, 4, 5, 6] },
  ],
});

const seriesAWithMultipleFields = toDataFrame({
  name: 'A',
  fields: [
    { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
    { name: 'temperature', type: FieldType.number, values: [3, 4, 5, 6] },
    { name: 'humidity', type: FieldType.number, values: [10000.3, 10000.4, 10000.5, 10000.6] },
  ],
});

const seriesBWithSingleField = toDataFrame({
  name: 'B',
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 3000, 5000, 7000] },
    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
  ],
});

const seriesBWithMultipleFields = toDataFrame({
  name: 'B',
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 3000, 5000, 7000] },
    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
    { name: 'humidity', type: FieldType.number, values: [11000.1, 11000.3, 11000.5, 11000.7] },
  ],
});

describe('Reducer Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([reduceTransformer]);
  });

  it('reduces multiple data frames with many fields', () => {
    const cfg = {
      id: DataTransformerID.reduce,
      options: {
        reducers: [ReducerID.first, ReducerID.min, ReducerID.max, ReducerID.last],
      },
    };
    const processed = transformDataFrame([cfg], [seriesAWithMultipleFields, seriesBWithMultipleFields])[0];
    const expected: Field[] = [
      {
        name: 'Field',
        type: FieldType.string,
        values: new ArrayVector(['temperature {A}', 'humidity {A}', 'temperature {B}', 'humidity {B}']),
        config: {},
      },
      {
        name: 'first',
        type: FieldType.number,
        values: new ArrayVector([3, 10000.3, 1, 11000.1]),
        config: { title: 'First' },
      },
      {
        name: 'min',
        type: FieldType.number,
        values: new ArrayVector([3, 10000.3, 1, 11000.1]),
        config: { title: 'Min' },
      },
      {
        name: 'max',
        type: FieldType.number,
        values: new ArrayVector([6, 10000.6, 7, 11000.7]),
        config: { title: 'Max' },
      },
      {
        name: 'last',
        type: FieldType.number,
        values: new ArrayVector([6, 10000.6, 7, 11000.7]),
        config: { title: 'Last' },
      },
    ];
    expect(processed.fields).toEqual(expected);
  });

  it('reduces multiple data frames with single field', () => {
    const cfg = {
      id: DataTransformerID.reduce,
      options: {
        reducers: [ReducerID.first, ReducerID.min, ReducerID.max, ReducerID.last],
      },
    };
    const processed = transformDataFrame([cfg], [seriesAWithSingleField, seriesBWithSingleField])[0];
    const expected: Field[] = [
      {
        name: 'Field',
        type: FieldType.string,
        values: new ArrayVector(['temperature {A}', 'temperature {B}']),
        config: {},
      },
      {
        name: 'first',
        type: FieldType.number,
        values: new ArrayVector([3, 1]),
        config: { title: 'First' },
      },
      {
        name: 'min',
        type: FieldType.number,
        values: new ArrayVector([3, 1]),
        config: { title: 'Min' },
      },
      {
        name: 'max',
        type: FieldType.number,
        values: new ArrayVector([6, 7]),
        config: { title: 'Max' },
      },
      {
        name: 'last',
        type: FieldType.number,
        values: new ArrayVector([6, 7]),
        config: { title: 'Last' },
      },
    ];
    expect(processed.fields).toEqual(expected);
  });

  it('reduces single data frame with many fields', () => {
    const cfg = {
      id: DataTransformerID.reduce,
      options: {
        reducers: [ReducerID.first, ReducerID.min, ReducerID.max, ReducerID.last],
      },
    };
    const processed = transformDataFrame([cfg], [seriesAWithMultipleFields])[0];
    const expected: Field[] = [
      {
        name: 'Field',
        type: FieldType.string,
        values: new ArrayVector(['temperature', 'humidity']),
        config: {},
      },
      {
        name: 'first',
        type: FieldType.number,
        values: new ArrayVector([3, 10000.3]),
        config: { title: 'First' },
      },
      {
        name: 'min',
        type: FieldType.number,
        values: new ArrayVector([3, 10000.3]),
        config: { title: 'Min' },
      },
      {
        name: 'max',
        type: FieldType.number,
        values: new ArrayVector([6, 10000.6]),
        config: { title: 'Max' },
      },
      {
        name: 'last',
        type: FieldType.number,
        values: new ArrayVector([6, 10000.6]),
        config: { title: 'Last' },
      },
    ];
    expect(processed.fields).toEqual(expected);
  });

  it('reduces single data frame with single field', () => {
    const cfg = {
      id: DataTransformerID.reduce,
      options: {
        reducers: [ReducerID.first, ReducerID.min, ReducerID.max, ReducerID.last],
      },
    };
    const processed = transformDataFrame([cfg], [seriesAWithSingleField])[0];
    const expected: Field[] = [
      {
        name: 'Field',
        type: FieldType.string,
        values: new ArrayVector(['temperature']),
        config: {},
      },
      {
        name: 'first',
        type: FieldType.number,
        values: new ArrayVector([3]),
        config: { title: 'First' },
      },
      {
        name: 'min',
        type: FieldType.number,
        values: new ArrayVector([3]),
        config: { title: 'Min' },
      },
      {
        name: 'max',
        type: FieldType.number,
        values: new ArrayVector([6]),
        config: { title: 'Max' },
      },
      {
        name: 'last',
        type: FieldType.number,
        values: new ArrayVector([6]),
        config: { title: 'Last' },
      },
    ];
    expect(processed.fields).toEqual(expected);
  });
});
