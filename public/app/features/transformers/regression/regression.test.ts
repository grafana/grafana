import {
  DataFrame,
  DataFrameDTO,
  DataTransformContext,
  Field,
  FieldType,
  toDataFrame,
  toDataFrameDTO,
} from '@grafana/data';

import { ModelType, getRegressionTransformer, RegressionTransformerOptions } from './regression';

describe('Trendline transformation', () => {
  const RegressionTransformer = getRegressionTransformer();

  it('it should predict a linear regression to exactly fit the data when the data is f(x) = x', () => {
    const source = [
      toDataFrame({
        name: 'data',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
          { name: 'value', type: FieldType.number, values: [0, 1, 2, 3, 4, 5] },
        ],
      }),
    ];

    const config: RegressionTransformerOptions = {
      modelType: ModelType.linear,
      predictionCount: 6,
      xFieldName: 'time',
      yFieldName: 'value',
    };

    expect(toEquableDataFrames(RegressionTransformer.transformer(config, {} as DataTransformContext)(source))).toEqual(
      toEquableDataFrames([
        toEquableDataFrame({
          name: 'data',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5], config: {} },
            { name: 'value', type: FieldType.number, values: [0, 1, 2, 3, 4, 5], config: {} },
          ],
          length: 6,
        }),
        toEquableDataFrame({
          name: 'Linear regression',
          fields: [
            { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5], config: {} },
            { name: 'value', type: FieldType.number, values: [0, 1, 2, 3, 4, 5], config: {} },
          ],
          length: 6,
        }),
      ])
    );
  });
  it('it should predict a linear regression where f(x) = 1', () => {
    const source = [
      toDataFrame({
        name: 'data',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
          { name: 'value', type: FieldType.number, values: [0, 1, 2, 2, 1, 0] },
        ],
      }),
    ];

    const config: RegressionTransformerOptions = {
      modelType: ModelType.linear,
      predictionCount: 6,
      xFieldName: 'time',
      yFieldName: 'value',
    };

    expect(toEquableDataFrames(RegressionTransformer.transformer(config, {} as DataTransformContext)(source))).toEqual(
      toEquableDataFrames([
        toEquableDataFrame({
          name: 'data',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5], config: {} },
            { name: 'value', type: FieldType.number, values: [0, 1, 2, 2, 1, 0], config: {} },
          ],
          length: 6,
        }),
        toEquableDataFrame({
          name: 'Linear regression',
          fields: [
            { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5], config: {} },
            { name: 'value', type: FieldType.number, values: [1, 1, 1, 1, 1, 1], config: {} },
          ],
          length: 6,
        }),
      ])
    );
  });

  it('it should predict a quadratic function', () => {
    const source = [
      toDataFrame({
        name: 'data',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
          { name: 'value', type: FieldType.number, values: [0, 1, 2, 2, 1, 0] },
        ],
      }),
    ];

    const config: RegressionTransformerOptions = {
      modelType: ModelType.polynomial,
      degree: 2,
      predictionCount: 6,
      xFieldName: 'time',
      yFieldName: 'value',
    };

    const result = RegressionTransformer.transformer(config, {} as DataTransformContext)(source);

    expect(result[1].fields[1].values[0]).toBeCloseTo(-0.1, 1);
    expect(result[1].fields[1].values[1]).toBeCloseTo(1.2, 1);
    expect(result[1].fields[1].values[2]).toBeCloseTo(1.86, 1);
    expect(result[1].fields[1].values[3]).toBeCloseTo(1.86, 1);
    expect(result[1].fields[1].values[4]).toBeCloseTo(1.2, 1);
    expect(result[1].fields[1].values[5]).toBeCloseTo(-0.1, 1);
    expect(result[1].name).toBe('Quadratic polynomial regression');
  });

  it('should have the last x point be equal to the last x point of the data', () => {
    const source = [
      toDataFrame({
        name: 'data',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4] },
          { name: 'value', type: FieldType.number, values: [1, 1, 1, 1, 1] },
        ],
      }),
    ];

    const config: RegressionTransformerOptions = {
      modelType: ModelType.polynomial,
      degree: 2,
      predictionCount: 10,
      xFieldName: 'time',
      yFieldName: 'value',
    };

    const result = RegressionTransformer.transformer(config, {} as DataTransformContext)(source);

    expect(result[1].fields[0].values[0]).toBe(0);
    expect(result[1].fields[0].values[1]).toBeCloseTo(0.44, 1);
    expect(result[1].fields[0].values[4]).toBeCloseTo(1.76, 1);
    expect(result[1].fields[0].values[8]).toBeCloseTo(3.55, 1);
    expect(result[1].fields[0].values[9]).toBe(4);
    expect(result[1].name).toBe('Quadratic polynomial regression');
  });

  it('should filter NaNs', () => {
    const source = [
      toDataFrame({
        name: 'data',
        refId: 'A',
        fields: [
          { name: 'y', type: FieldType.number, values: [0, 1, 2, 3, NaN] },
          { name: 'x', type: FieldType.number, values: [0, 1, 2, 3, 4] },
        ],
      }),
    ];

    const config: RegressionTransformerOptions = {
      modelType: ModelType.linear,
      predictionCount: 5,
      xFieldName: 'x',
      yFieldName: 'y',
    };

    const result = RegressionTransformer.transformer(config, {} as DataTransformContext)(source);

    expect(result[1].fields[1].values[0]).toBe(0);
    expect(result[1].fields[1].values[1]).toBe(1);
    expect(result[1].fields[1].values[2]).toBe(2);
    expect(result[1].fields[1].values[3]).toBe(3);
    expect(result[1].fields[1].values[4]).toBe(4);
    expect(result[1].name).toBe('Linear regression');
  });
});

function toEquableDataFrame(source: DataFrame): DataFrame {
  return toDataFrame({
    ...source,
    fields: source.fields.map((field: Field) => {
      return {
        ...field,
        config: {},
      };
    }),
  });
}

function toEquableDataFrames(data: DataFrame[]): DataFrameDTO[] {
  return data.map((frame) => toDataFrameDTO(frame));
}
