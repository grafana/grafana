import { linear, polynomial, DataPoint, Result } from 'regression';
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
  precision?: number;
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
      // If the field type is time we'll use the microsecond epoch value,
      // this number is too big compared to normal value ranges and make
      // the coefficients so small we run into javascript float issues.
      // To alleviate this problem we normalize the epoch millis to the
      // start of the time range.
      const lowest = xField.type === FieldType.time ? xField.values[0] : 0;

      const yValues = yField.values;
      const dataPoints = xField.values.map<DataPoint>((v, i) => {
        return [v - lowest, yValues[i]];
      });

      let result: Result;
      switch (options.modelType) {
        case ModelType.linear:
          result = linear(dataPoints, { precision: options.precision });
          break;
        case ModelType.polynomial:
          result = polynomial(dataPoints, { precision: options.precision, order: options.order });
          break;
        default:
          throw 'model type not found';
      }

      const newFrame: DataFrame = {
        name: `${options.modelType} regression`,
        length: xField.values.length,
        fields: [
          { name: xField.name, type: xField.type, values: xField.values, config: {} },
          {
            name: yField.name,
            type: yField.type,
            values: xField.values.map((v) => result.predict(v - lowest)).map((d) => d[1]),
            config: {},
          },
        ],
      };

      return [...frames, newFrame];
    };
  },
};
