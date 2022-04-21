import { XYFieldMatchers } from './types';
import { ArrayVector, DataFrame, Field, FieldConfig, FieldType, outerJoinDataFrames, TimeRange } from '@grafana/data';
import { nullToUndefThreshold } from './nullToUndefThreshold';
import { applyNullInsertThreshold } from './nullInsertThreshold';
import {
  AxisPlacement,
  GraphDrawStyle,
  GraphFieldConfig,
  ScaleDistribution,
  ScaleDistributionConfig,
} from '@grafana/schema';
import { FIXED_UNIT } from './GraphNG';

// will mutate the DataFrame's fields' values
function applySpanNullsThresholds(frame: DataFrame) {
  let refField = frame.fields.find((field) => field.type === FieldType.time); // this doesnt need to be time, just any numeric/asc join field
  let refValues = refField?.values.toArray() as any[];

  for (let i = 0; i < frame.fields.length; i++) {
    let field = frame.fields[i];

    if (field === refField) {
      continue;
    }

    let spanNulls = field.config.custom?.spanNulls;

    if (typeof spanNulls === 'number') {
      if (spanNulls !== -1) {
        field.values = new ArrayVector(nullToUndefThreshold(refValues, field.values.toArray(), spanNulls));
      }
    }
  }

  return frame;
}

function isBarsField(f: Field) {
  return f.type === FieldType.number && f.config.custom?.drawStyle === GraphDrawStyle.Bars;
}

export function preparePlotFrame(frames: DataFrame[], dimFields: XYFieldMatchers, timeRange?: TimeRange | null) {
  // make bar widths of all series uniform (equal to narrowest bar series)
  // find smallest distance between x points
  let minXDelta = Infinity;

  frames.forEach((frame) => {
    if (frame.fields.some(isBarsField)) {
      const xVals = frame.fields[0].values.toArray();

      for (let i = 0; i < xVals.length; i++) {
        if (i > 0) {
          minXDelta = Math.min(minXDelta, xVals[i] - xVals[i - 1]);
        }
      }
    }
  });

  let alignedFrame = outerJoinDataFrames({
    frames: frames.map((frame) => {
      let fr = applyNullInsertThreshold(frame, null, timeRange?.to.valueOf());

      // prevent minesweeper-expansion of nulls (gaps) when joining bars
      // since bar width is determined from the minimum distance between non-undefined values
      // (this strategy will still retain any original pre-join nulls, though)
      fr.fields.forEach((f) => {
        if (isBarsField(f)) {
          f.config.custom = {
            ...f.config.custom,
            spanNulls: -1,
          };
        }
      });

      return fr;
    }),
    joinBy: dimFields.x,
    keep: dimFields.y,
    keepOriginIndices: true,
  });

  if (alignedFrame) {
    alignedFrame = applySpanNullsThresholds(alignedFrame);

    // append 2 null vals at minXDelta to bar series
    if (minXDelta !== Infinity) {
      alignedFrame.fields.forEach((f, fi) => {
        let vals = f.values.toArray();

        if (fi === 0) {
          let lastVal = vals[vals.length - 1];
          vals.push(lastVal + minXDelta, lastVal + 2 * minXDelta);
        } else if (isBarsField(f)) {
          vals.push(null, null);
        } else {
          vals.push(undefined, undefined);
        }
      });
    }

    return alignedFrame;
  }

  return null;
}

export function buildScaleKey(config: FieldConfig<GraphFieldConfig>) {
  const defaultPart = 'na';

  const scaleRange = `${config.min !== undefined ? config.min : defaultPart}-${
    config.max !== undefined ? config.max : defaultPart
  }`;

  const scaleSoftRange = `${config.custom?.axisSoftMin !== undefined ? config.custom.axisSoftMin : defaultPart}-${
    config.custom?.axisSoftMax !== undefined ? config.custom.axisSoftMax : defaultPart
  }`;

  const scalePlacement = `${
    config.custom?.axisPlacement !== undefined ? config.custom?.axisPlacement : AxisPlacement.Auto
  }`;

  const scaleUnit = config.unit ?? FIXED_UNIT;

  const scaleDistribution = config.custom?.scaleDistribution
    ? getScaleDistributionPart(config.custom.scaleDistribution)
    : ScaleDistribution.Linear;

  const scaleLabel = Boolean(config.custom?.axisLabel) ? config.custom!.axisLabel : defaultPart;

  return `${scaleUnit}/${scaleRange}/${scaleSoftRange}/${scalePlacement}/${scaleDistribution}/${scaleLabel}`;
}

function getScaleDistributionPart(config: ScaleDistributionConfig) {
  if (config.type === ScaleDistribution.Log) {
    return `${config.type}${config.log}`;
  }
  return config.type;
}
