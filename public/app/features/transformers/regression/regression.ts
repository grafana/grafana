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
  getFieldDisplayName,
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
  predictionCount?: number;
}

export const DEFAULTS = { predictionCount: 100, modelType: ModelType.linear, degree: 2 };

export const RegressionTransformer: SynchronousDataTransformerInfo<RegressionTransformerOptions> = {
  id: DataTransformerID.regression,
  name: 'Regression analysis',
  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => RegressionTransformer.transformer(options, ctx)(data))),
  transformer: (options, ctx) => {
    return (frames: DataFrame[]) => {
      const { predictionCount, modelType, degree } = { ...DEFAULTS, ...options };
      if (frames.length === 0) {
        return frames;
      }
      const matchesY = fieldMatchers.get(FieldMatcherID.byName).get(options.yFieldName);
      const matchesX = fieldMatchers.get(FieldMatcherID.byName).get(options.xFieldName);

      let xField;
      let yField;
      let predictFromFrame;
      for (const frame of frames) {
        const fy = frame.fields.find((f) => matchesY(f, frame, frames));
        if (fy) {
          yField = fy;
          const fx = frame.fields.find((f) => matchesX(f, frame, frames));
          if (fx) {
            xField = fx;
            predictFromFrame = frame;
            break;
          } else {
            throw 'X and Y fields must be part of the same frame';
          }
        }
      }

      if (!xField || !yField) {
        return frames;
      }

      let xMin = xField.values[0];
      let xMax = xField.values[0];

      for (let i = 1; i < xField.values.length; i++) {
        if (xField.values[i] < xMin) {
          xMin = xField.values[i];
        }
        if (xField.values[i] > xMax) {
          xMax = xField.values[i];
        }
      }

      const resolution = (xMax - xMin) / (predictionCount - 1);

      // These are the X values for which we should predict Y
      const predictionPoints = [...[...Array(predictionCount - 1).keys()].map((_, i) => i * resolution + xMin), xMax];

      // If X is a time field we normalize the time to the start of the timeseries data
      const normalizationSubtrahend = xField.type === FieldType.time ? xMin : 0;

      const yValues = [];
      const xValues = [];

      for (let i = 0; i < xField.values.length; i++) {
        if (yField.values[i] !== null && !isNaN(yField.values[i])) {
          xValues.push(xField.values[i] - normalizationSubtrahend);
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
        length: predictionPoints.length,
        fields: [
          { name: xField.name, type: xField.type, values: predictionPoints, config: {} },
          {
            name: `${getFieldDisplayName(yField, predictFromFrame, frames)} predicted`,
            type: yField.type,
            values: predictionPoints.map((x) => result.predict(x - normalizationSubtrahend)),
            config: {},
          },
        ],
      };

      return [...frames, newFrame];
    };
  },
};
