import { map } from 'rxjs';

import {
  DataFrame,
  DataTransformerID,
  FieldType,
  SynchronousDataTransformerInfo,
  isTimeSeriesFrame,
  TransformationApplicabilityLevels,
} from '@grafana/data';
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

const MAX_RESOLUTION_MULTIPLIER = 2;

// converts time and value arrays into valid DataPoints, filtering out null/NaN values
export const createDataPoints = (timeValues: number[], sourceField: Array<number | null | undefined>): DataPoint[] => {
  return timeValues
    .map((time, index) => ({
      x: time,
      y: sourceField[index],
    }))
    .filter((point): point is DataPoint => point.y != null && !isNaN(point.y));
};

// calculates effective resolution capped at 2x source points
export const calculateEffectiveResolution = (resolution: number, sourcePointCount: number): number => {
  return Math.min(resolution, sourcePointCount * MAX_RESOLUTION_MULTIPLIER);
};

// calculates the maximum number of source points across all numeric fields in all frames
export const calculateMaxSourcePoints = (frames: DataFrame[]): number => {
  let maxSourcePoints = 0;

  for (const frame of frames) {
    const timeField = frame.fields.find((f) => f.type === FieldType.time);
    if (!timeField) {
      continue;
    }

    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        const sourcePoints = createDataPoints(timeField.values, field.values);
        if (sourcePoints.length > maxSourcePoints) {
          maxSourcePoints = sourcePoints.length;
        }
      }
    }
  }

  return maxSourcePoints;
};

// performs linear interpolation between two points
export const linearInterpolate = (leftPoint: DataPoint, rightPoint: DataPoint, targetTime: number): number => {
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
};

// finds the two points in smoothedData that bracket the targetTime
export const findBracketingPoints = (
  smoothedData: DataPoint[],
  targetTime: number,
  lastIndex: number
): { leftPoint: DataPoint; rightPoint: DataPoint; newIndex: number } => {
  // find the two points to interpolate between, starting from last known position
  // if target is before our current search position, reset to beginning
  let searchStart = Math.min(lastIndex, smoothedData.length - 2);
  if (targetTime < smoothedData[searchStart].x) {
    searchStart = 0;
  }

  let leftPoint = smoothedData[searchStart];
  let rightPoint = smoothedData[searchStart + 1];
  let newIndex = searchStart;

  for (let i = searchStart; i < smoothedData.length - 1; i++) {
    if (smoothedData[i].x <= targetTime && smoothedData[i + 1].x >= targetTime) {
      leftPoint = smoothedData[i];
      rightPoint = smoothedData[i + 1];
      newIndex = i;
      break;
    }
  }

  return { leftPoint, rightPoint, newIndex };
};

// interpolates smoothed data back to original time points
export const interpolateToTimePoints = (smoothedData: DataPoint[], timeValues: number[]): number[] => {
  const firstPoint = smoothedData[0];
  const lastPoint = smoothedData[smoothedData.length - 1];

  let lastIndex = 0;
  return timeValues.map((targetTime) => {
    // handle out of bounds, use edge values instead of null
    if (targetTime <= firstPoint.x) {
      return firstPoint.y;
    }
    if (targetTime >= lastPoint.x) {
      return lastPoint.y;
    }

    const { leftPoint, rightPoint, newIndex } = findBracketingPoints(smoothedData, targetTime, lastIndex);
    lastIndex = newIndex;

    return linearInterpolate(leftPoint, rightPoint, targetTime);
  });
};

// smooths a time series by creating a smoothed curve and interpolating back to original time points
export const interpolateFromSmoothedCurve = (
  sourceField: Array<number | null | undefined>,
  timeValues: number[],
  resolution: number
): Array<number | null> | null => {
  const sourcePoints = createDataPoints(timeValues, sourceField);

  // if no valid source points, return null to signal this field should not be smoothed
  if (sourcePoints.length === 0) {
    return null;
  }

  // smooth the source field's data with effective resolution
  const effectiveFieldResolution = calculateEffectiveResolution(resolution, sourcePoints.length);
  const smoothedData = asapSmooth(sourcePoints, { resolution: effectiveFieldResolution });

  if (smoothedData.length === 0) {
    return timeValues.map(() => null);
  }

  // handle single point case - return the same value for all time points
  if (smoothedData.length === 1) {
    const singleValue = smoothedData[0].y;
    return timeValues.map(() => singleValue);
  }

  // this prevents O(m×n) degradation if asapSmooth returns unsorted data
  smoothedData.sort((a, b) => a.x - b.x);

  // interpolate smoothed data back to original time points
  return interpolateToTimePoints(smoothedData, timeValues);
};

export const getSmoothingTransformer: () => SynchronousDataTransformerInfo<SmoothingTransformerOptions> = () => ({
  id: DataTransformerID.smoothing,
  name: t('transformers.smoothing.name', 'Smoothing'),
  description: t(
    'transformers.smoothing.description',
    'Reduce noise in time series data through adaptive downsampling.'
  ),
  isApplicable: (data) => {
    for (const frame of data) {
      if (isTimeSeriesFrame(frame)) {
        return TransformationApplicabilityLevels.Applicable;
      }
    }

    return TransformationApplicabilityLevels.NotApplicable;
  },
  isApplicableDescription: t(
    'transformers.smoothing.is-applicable-description',
    'The Smoothing transformation requires at least one time series frame to function. You currently have none.'
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

      const smoothedFrames: DataFrame[] = [];

      for (const frame of frames) {
        const timeField = frame.fields.find((f) => f.type === FieldType.time);
        if (!timeField) {
          continue;
        }

        // check if there's at least one numeric field with valid data
        const hasValidNumericField = frame.fields.some((f) => {
          if (f.type !== FieldType.number || f.values.length === 0) {
            return false;
          }
          return f.values.some((v) => v != null && !isNaN(v));
        });

        if (!hasValidNumericField) {
          continue;
        }

        // create smoothed fields for all numeric fields
        const smoothedFields = [timeField]; // keep original time field
        let anyFieldSmoothed = false;

        for (const field of frame.fields) {
          if (field.type === FieldType.number) {
            const smoothedValues = interpolateFromSmoothedCurve(field.values, timeField.values, resolution);

            // if smoothing returned null (no valid data), skip this field
            if (smoothedValues === null) {
              continue;
            }

            anyFieldSmoothed = true;
            smoothedFields.push({
              ...field,
              values: smoothedValues,
            });
          } else if (field.type !== FieldType.time) {
            // include other non-numeric, non-time fields (like labels)
            smoothedFields.push(field);
          }
        }

        // only create a smoothed frame if at least one field was smoothed
        if (anyFieldSmoothed) {
          const smoothedFrame: DataFrame = {
            ...frame,
            name: 'Smoothed',
            fields: smoothedFields,
          };
          smoothedFrames.push(smoothedFrame);
        }
      }

      // return original frames followed by smoothed frames
      return [...frames, ...smoothedFrames];
    };
  },
});
