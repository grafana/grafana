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

export const RESOLUTION_LIMITS = {
  min: 1,
  max: 1000,
};

export const getSmoothingTransformer: () => SynchronousDataTransformerInfo<SmoothingTransformerOptions> = () => ({
  id: DataTransformerID.smoothing,
  name: t('transformers.smoothing.name', 'Smoothing'),
  description: t(
    'transformers.smoothing.description',
    'Reduce noise in time series data through adaptive downsampling.'
  ),
  operator: (options, ctx) => {
    const transformer = getSmoothingTransformer().transformer(options, ctx);
    return (source) => source.pipe(map(transformer));
  },
  transformer: (options, ctx) => {
    return (frames: DataFrame[]) => {
      // clamp resolution to valid range to handle edge cases from API/plugins
      const rawResolution = options.resolution ?? DEFAULTS.resolution;
      const resolution = Math.max(RESOLUTION_LIMITS.min, Math.min(RESOLUTION_LIMITS.max, rawResolution));

      if (frames.length === 0) {
        return frames;
      }

      return frames.map((frame) => {
        const timeField = frame.fields.find((f) => f.type === FieldType.time);
        if (!timeField) {
          return frame;
        }

        // check if there's at least one numeric field with valid data
        const hasValidNumericField = frame.fields.some((f) => {
          if (f.type !== FieldType.number || f.values.length === 0) {
            return false;
          }
          return f.values.some((v) => v != null && !isNaN(v));
        });

        if (!hasValidNumericField) {
          return frame;
        }

        // interpolate smoothed curve back to original time points
        const interpolateFromSmoothedCurve = (
          sourceField: Array<number | null | undefined>
        ): Array<number | null> | null => {
          const sourcePoints: DataPoint[] = timeField.values
            .map((time, index) => ({
              x: time,
              y: sourceField[index],
            }))
            .filter((point): point is DataPoint => point.y != null && !isNaN(point.y));

          // if no valid source points, return null to signal this field should not be smoothed
          if (sourcePoints.length === 0) {
            return null;
          }

          // smooth the source field's data with effective resolution
          // cap resolution at 2x source points to prevent ASAP from requesting more points than reasonable
          const MAX_RESOLUTION_MULTIPLIER = 2;
          const effectiveFieldResolution = Math.min(resolution, sourcePoints.length * MAX_RESOLUTION_MULTIPLIER);
          const smoothedData = asapSmooth(sourcePoints, { resolution: effectiveFieldResolution });

          if (smoothedData.length === 0) {
            return timeField.values.map(() => null);
          }

          // handle single point case - return the same value for all time points
          if (smoothedData.length === 1) {
            const singleValue = smoothedData[0].y;
            return timeField.values.map(() => singleValue);
          }

          // interpolate smoothed data back to original time points
          let lastIndex = 0;
          return timeField.values.map((targetTime) => {
            const firstPoint = smoothedData[0];
            const lastPoint = smoothedData[smoothedData.length - 1];

            // handle out of bounds - use edge values instead of null
            if (targetTime <= firstPoint.x) {
              return firstPoint.y;
            }
            if (targetTime >= lastPoint.x) {
              return lastPoint.y;
            }

            // find the two points to interpolate between, starting from last known position
            // if target is before our current search position, reset to beginning
            let searchStart = Math.min(lastIndex, smoothedData.length - 2);
            if (targetTime < smoothedData[searchStart].x) {
              searchStart = 0;
              lastIndex = 0;
            }

            let leftPoint = smoothedData[searchStart];
            let rightPoint = smoothedData[searchStart + 1];

            for (let i = searchStart; i < smoothedData.length - 1; i++) {
              if (smoothedData[i].x <= targetTime && smoothedData[i + 1].x >= targetTime) {
                leftPoint = smoothedData[i];
                rightPoint = smoothedData[i + 1];
                lastIndex = i;
                break;
              }
            }

            // exact match
            if (leftPoint.x === targetTime) {
              return leftPoint.y;
            }
            if (rightPoint.x === targetTime) {
              return rightPoint.y;
            }

            // same point (shouldn't happen but handle gracefully)
            if (leftPoint.x === rightPoint.x) {
              return leftPoint.y;
            }

            // linear interpolation
            const ratio = (targetTime - leftPoint.x) / (rightPoint.x - leftPoint.x);
            return leftPoint.y + ratio * (rightPoint.y - leftPoint.y);
          });
        };

        let anyFieldSmoothed = false;
        const newFields = frame.fields.map((field) => {
          if (field.type === FieldType.time) {
            // keep original time points
            return field;
          } else if (field.type === FieldType.number) {
            const smoothedValues = interpolateFromSmoothedCurve(field.values);

            // if smoothing returned null (no valid data), keep the original field unchanged
            if (smoothedValues === null) {
              return field;
            }

            anyFieldSmoothed = true;
            return {
              ...field,
              name: `${field.name} (smoothed)`,
              values: smoothedValues,
            };
          }
          return field;
        });

        // only add (smoothed) suffix to frame name if at least one field was smoothed
        return {
          ...frame,
          fields: newFields,
          name: anyFieldSmoothed ? `${frame.name || 'Data'} (smoothed)` : frame.name || 'Data',
        };
      });
    };
  },
});
