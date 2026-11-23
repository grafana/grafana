import {
  type DataFrame,
  type DataFrameDTO,
  type DataTransformContext,
  FieldMatcherID,
  FieldType,
  fieldMatchers,
  getFieldDisplayName,
  toDataFrame,
  toDataFrameDTO,
} from '@grafana/data';

import { ModelType, getRegressionTransformer, type RegressionTransformerOptions } from './regression';

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
            {
              name: 'value predicted',
              type: FieldType.number,
              values: [0, 1, 2, 3, 4, 5],
              config: { displayNameFromDS: 'Linear regression value' },
            },
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
            {
              name: 'value predicted',
              type: FieldType.number,
              values: [1, 1, 1, 1, 1, 1],
              config: { displayNameFromDS: 'Linear regression value' },
            },
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

  describe('when the source frame has no name', () => {
    // Without a frame name, the source series is labelled with its bare field name
    const transformUnnamedSource = (yFieldName: string) => {
      const source = [
        toDataFrame({
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
            { name: yFieldName, type: FieldType.number, values: [0, 1, 2, 3, 4, 5] },
          ],
        }),
      ];

      const config: RegressionTransformerOptions = {
        modelType: ModelType.linear,
        predictionCount: 6,
        xFieldName: 'time',
        yFieldName,
      };

      return RegressionTransformer.transformer(config, {} as DataTransformContext)(source);
    };

    it('matches the source series but not the trendline by the source series name', () => {
      const result = transformUnnamedSource('value');
      const [sourceFrame, trendlineFrame] = result;
      // The legend hides and isolates series with a names matcher on their display names
      const matcher = fieldMatchers.get(FieldMatcherID.byNames).get({ names: ['value'] });

      expect(matcher(sourceFrame.fields[1], sourceFrame, result)).toBe(true);
      expect(matcher(trendlineFrame.fields[1], trendlineFrame, result)).toBe(false);
    });

    it.each([
      { yFieldName: 'value', label: 'Linear regression value' },
      { yFieldName: 'Value', label: 'Linear regression' },
    ])('labels the trendline of $yFieldName as $label', ({ yFieldName, label }) => {
      const result = transformUnnamedSource(yFieldName);

      expect(getFieldDisplayName(result[1].fields[1], result[1], result)).toBe(label);
    });
  });
});

function toEquableDataFrame(source: DataFrame): DataFrame {
  return toDataFrame(source);
}

function toEquableDataFrames(data: DataFrame[]): DataFrameDTO[] {
  return data.map((frame) => toDataFrameDTO(frame));
}
