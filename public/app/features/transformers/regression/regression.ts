import { PolynomialRegression } from 'ml-regression-polynomial';
import { SimpleLinearRegression } from 'ml-regression-simple-linear';
import { map } from 'rxjs';

import {
  DataFrame,
  DataTransformerID,
  FieldMatcherID,
  FieldType,
  SynchronousDataTransformerInfo,
  fieldMatchers,
} from '@grafana/data';

export enum ModelType {
  linear = 'linear',
  polynomial = 'polynomial',
}

export interface RegressionTransformerOptions {
  modelType?: ModelType;
  degree?: number;
  xFieldName?: string;
  yFieldName?: string;
  resolution?: number;
}

export const DEFAULTS = { resolution: 100, modelType: ModelType.linear, degree: 2 };

export const RegressionTransformer: SynchronousDataTransformerInfo<RegressionTransformerOptions> = {
  id: DataTransformerID.regression,
  name: 'Regression',
  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => RegressionTransformer.transformer(options, ctx)(data))),
  transformer: (options, ctx) => {
    return (frames: DataFrame[]) => {
      const { resolution, modelType, degree } = { ...DEFAULTS, ...options };
      if (frames.length === 0) {
        return frames;
      }
      const matchesY = fieldMatchers.get(FieldMatcherID.byName).get(options.yFieldName);
      const matchesX = fieldMatchers.get(FieldMatcherID.byName).get(options.xFieldName);

      let xField;
      let yField;
      for (const frame of frames) {
        const fy = frame.fields.find((f) => matchesY(f, frame, frames));
        if (fy) {
          yField = fy;
          const fx = frame.fields.find((f) => matchesX(f, frame, frames));
          if (fx) {
            xField = fx;
            break;
          } else {
            throw 'X and Y fields must be part of the same frame';
          }
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
      switch (modelType) {
        case ModelType.linear:
          result = new SimpleLinearRegression(xValues, yValues);
          break;
        case ModelType.polynomial:
          result = new PolynomialRegression(xValues, yValues, degree);
          break;
        default:
          return frames;
      }

      const newFrame: DataFrame = {
        name: `${modelType} regression`,
        length: points.length,
        fields: [
          { name: xField.name, type: xField.type, values: points, config: {} },
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
