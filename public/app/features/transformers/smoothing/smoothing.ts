import { map } from 'rxjs';

import { DataFrame, DataTransformerID, FieldType, SynchronousDataTransformerInfo } from '@grafana/data';
import { t } from '@grafana/i18n';

import { asapSmooth, DataPoint } from './asap';

export interface SmoothingTransformerOptions {
  resolution?: number;
}

export const DEFAULTS = {
  resolution: 100,
};

export const getSmoothingTransformer: () => SynchronousDataTransformerInfo<SmoothingTransformerOptions> = () => ({
  id: DataTransformerID.smoothing,
  name: t('transformers.smoothing.name', 'Smoothing'),
  description: t(
    'transformers.smoothing.description',
    'Reduce noise in time series data through adaptive downsampling.'
  ),
  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => getSmoothingTransformer().transformer(options, ctx)(data))),
  transformer: (options, ctx) => {
    return (frames: DataFrame[]) => {
      const { resolution = DEFAULTS.resolution } = options;

      if (frames.length === 0) {
        return frames;
      }

      return frames.map((frame) => {
        const timeField = frame.fields.find((f) => f.type === FieldType.time);
        if (!timeField) {
          return frame;
        }

        const firstNumericField = frame.fields.find((f) => f.type === FieldType.number && f.values.length > 0);
        if (!firstNumericField) {
          return frame;
        }

        const referencePoints: DataPoint[] = timeField.values
          .map((time, index) => ({
            x: time,
            y: firstNumericField.values[index],
          }))
          .filter((point) => point.y != null && !isNaN(point.y));

        if (referencePoints.length === 0) {
          return frame;
        }

        // run ASAP only once to determine optimal time points
        const smoothedReference = asapSmooth(referencePoints, { resolution });
        const smoothedTimes = smoothedReference.map((point) => point.x);

        const interpolateToTargetTimes = (sourceField: Array<number | null | undefined>): number[] => {
          const sourcePoints: DataPoint[] = timeField.values
            .map((time, index) => ({
              x: time,
              y: sourceField[index],
            }))
            .filter((point): point is DataPoint => point.y != null && !isNaN(point.y));

          if (sourcePoints.length === 0) {
            return new Array(smoothedTimes.length).fill(NaN);
          }

          return smoothedTimes.map((targetTime) => {
            let leftPoint = sourcePoints[0];
            let rightPoint = sourcePoints[sourcePoints.length - 1];

            for (let i = 0; i < sourcePoints.length - 1; i++) {
              if (sourcePoints[i].x <= targetTime && sourcePoints[i + 1].x >= targetTime) {
                leftPoint = sourcePoints[i];
                rightPoint = sourcePoints[i + 1];
                break;
              }
            }

            if (leftPoint.x === targetTime) {
              return leftPoint.y;
            }
            if (rightPoint.x === targetTime) {
              return rightPoint.y;
            }
            if (leftPoint.x === rightPoint.x) {
              return leftPoint.y;
            }

            const ratio = (targetTime - leftPoint.x) / (rightPoint.x - leftPoint.x);
            return leftPoint.y + ratio * (rightPoint.y - leftPoint.y);
          });
        };

        const newFields = frame.fields.map((field) => {
          if (field.type === FieldType.time) {
            return {
              ...field,
              values: smoothedTimes,
            };
          } else if (field.type === FieldType.number) {
            const smoothedValues = interpolateToTargetTimes(field.values);

            return {
              ...field,
              name: `${field.name} (smoothed)`,
              values: smoothedValues,
            };
          }
          return field;
        });

        return {
          ...frame,
          fields: newFields,
          name: `${frame.name || 'Data'} (smoothed)`,
        };
      });
    };
  },
});
