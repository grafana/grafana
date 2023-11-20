import { PolynomialRegression } from 'ml-regression-polynomial';
import { SimpleLinearRegression } from 'ml-regression-simple-linear';
import { map } from 'rxjs';

import {
  DataFrame,
  DataTransformerID,
  FieldType,
  SynchronousDataTransformerInfo,
  getFieldDisplayName,
} from '@grafana/data';

export enum ModelType {
  linear = 'linear',
  polynomial = 'polynomial',
}

export interface RegressionTransformerOptions {
  modelType?: ModelType;
  order?: number;
  xFieldName?: string;
  yFieldName?: string;
  resolution?: number;
}

export const RegressionTransformer: SynchronousDataTransformerInfo<RegressionTransformerOptions> = {
  id: DataTransformerID.regression,
  name: 'Regression',
  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => RegressionTransformer.transformer(options, ctx)(data))),
  transformer: (options, ctx) => {
    return (frames: DataFrame[]) => {
      const { resolution = 100 } = options;
      if (frames.length === 0) {
        return frames;
      }

      let xField;
      let yField;
      for (const frame of frames) {
        const fx = frame.fields.find((f) => options.xFieldName === getFieldDisplayName(f, frame, frames));
        if (fx) {
          xField = fx;
        }
        const fy = frame.fields.find((f) => options.yFieldName === getFieldDisplayName(f, frame, frames));
        if (fy) {
          yField = fy;
        }
      }

      if (!xField || !yField) {
        return frames;
      }

      // If x is a time field we normalize the time to the start of the timeseries data
      const xFieldIsTime = xField.type === FieldType.time;

      const lowest = Math.min(...xField.values);
      const highest = Math.max(...xField.values);

      const xToRes = (highest - lowest) / resolution;

      const points = [...[...Array(resolution).keys()].map((_, i) => i * xToRes + lowest), highest];

      const yValues = [];
      const xValues = [];

      for (let i = 0; i < xField.values.length; i++) {
        if (yField.values[i] !== null) {
          xValues.push(xField.values[i] - (xFieldIsTime ? lowest : 0));
          yValues.push(yField.values[i]);
        }
      }

      let result: PolynomialRegression | SimpleLinearRegression;
      switch (options.modelType) {
        case ModelType.linear:
          result = new SimpleLinearRegression(xValues, yValues);
          break;
        case ModelType.polynomial:
          result = new PolynomialRegression(xValues, yValues, options.order ?? 2);
          break;
        default:
          return frames;
      }

      const newFrame: DataFrame = {
        name: `${options.modelType} regression`,
        length: points.length,
        fields: [
          { name: `${xField.name} predicted`, type: xField.type, values: points, config: {} },
          {
            name: `${yField.name} predicted`,
            type: yField.type,
            values: points.map((x) => result.predict(x - (xFieldIsTime ? lowest : 0))),
            config: {},
          },
        ],
      };

      return [...frames, newFrame];
    };
  },
};
