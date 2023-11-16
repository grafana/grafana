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
}

export const RegressionTransformer: SynchronousDataTransformerInfo<RegressionTransformerOptions> = {
  id: DataTransformerID.regression,
  name: 'Regression',
  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => RegressionTransformer.transformer(options, ctx)(data))),
  transformer: (options, ctx) => {
    return (frames: DataFrame[]) => {
      if (frames.length === 0) {
        return frames;
      }

      let xField;
      let yField;
      for (const frame of frames) {
        const f = frame.fields.find((f) => options.xFieldName === getFieldDisplayName(f, frame, frames));
        if (f) {
          xField = f;
        }
      }
      for (const frame of frames) {
        const f = frame.fields.find((f) => options.yFieldName === getFieldDisplayName(f, frame, frames));
        if (f) {
          yField = f;
        }
      }

      if (!xField || !yField) {
        return frames;
      }

      // If x is a time field we normalize the time to the start of the timeseries
      const lowest = xField.type === FieldType.time ? xField.values[0] : 0;

      const yValues = yField.values;
      const xValues = xField.values.map((x) => {
        return x - lowest;
      });

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
        length: xField.values.length,
        fields: [
          { name: xField.name, type: xField.type, values: xField.values, config: {} },
          {
            name: yField.name,
            type: yField.type,
            values: xField.values.map((v) => result.predict(v - lowest)),
            config: {},
          },
        ],
      };

      return [...frames, newFrame];
    };
  },
};
