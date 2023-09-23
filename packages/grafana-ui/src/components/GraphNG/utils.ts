import { DataFrame, Field, FieldConfig, FieldType, outerJoinDataFrames, TimeRange } from '@grafana/data';
import {
  AxisPlacement,
  GraphDrawStyle,
  GraphFieldConfig,
  ScaleDistribution,
  ScaleDistributionConfig,
} from '@grafana/schema';

import { FIXED_UNIT } from './GraphNG';
import { applyNullInsertThreshold } from './nullInsertThreshold';
import { nullToUndefThreshold } from './nullToUndefThreshold';
import { XYFieldMatchers } from './types';

function isVisibleBarField(f: Field) {
  return (
    f.type === FieldType.number && f.config.custom?.drawStyle === GraphDrawStyle.Bars && !f.config.custom?.hideFrom?.viz
  );
}

export function getRefField(frame: DataFrame, refFieldName?: string | null) {
  return frame.fields.find((field) => {
    // note: getFieldDisplayName() would require full DF[]
    return refFieldName != null ? field.name === refFieldName : field.type === FieldType.time;
  });
}

// will mutate the DataFrame's fields' values
function applySpanNullsThresholds(frame: DataFrame, refFieldName?: string | null) {
  const refField = getRefField(frame, refFieldName);

  let refValues = refField?.values;

  for (let i = 0; i < frame.fields.length; i++) {
    let field = frame.fields[i];

    if (field === refField || isVisibleBarField(field)) {
      continue;
    }

    let spanNulls = field.config.custom?.spanNulls;

    if (typeof spanNulls === 'number') {
      if (spanNulls !== -1 && refValues) {
        field.values = nullToUndefThreshold(refValues, field.values, spanNulls);
      }
    }
  }

  return frame;
}

export function preparePlotFrame(frames: DataFrame[], dimFields: XYFieldMatchers, timeRange?: TimeRange | null) {
  let xField: Field;
  loop: for (let frame of frames) {
    for (let field of frame.fields) {
      if (dimFields.x(field, frame, frames)) {
        xField = field;
        break loop;
      }
    }
  }

  // apply null insertions at interval
  frames = frames.map((frame) => {
    if (!xField?.state?.nullThresholdApplied) {
      return applyNullInsertThreshold({
        frame,
        refFieldName: xField.name,
        refFieldPseudoMin: timeRange?.from.valueOf(),
        refFieldPseudoMax: timeRange?.to.valueOf(),
      });
    } else {
      return frame;
    }
  });

  let numBarSeries = 0;

  frames.forEach((frame) => {
    frame.fields.forEach((f) => {
      if (isVisibleBarField(f)) {
        // prevent minesweeper-expansion of nulls (gaps) when joining bars
        // since bar width is determined from the minimum distance between non-undefined values
        // (this strategy will still retain any original pre-join nulls, though)
        f.config.custom = {
          ...f.config.custom,
          spanNulls: -1,
        };

        numBarSeries++;
      }
    });
  });

  // to make bar widths of all series uniform (equal to narrowest bar series), find smallest distance between x points
  let minXDelta = Infinity;

  if (numBarSeries > 1) {
    frames.forEach((frame) => {
      if (!frame.fields.some(isVisibleBarField)) {
        return;
      }

      const xVals = xField.values;

      for (let i = 0; i < xVals.length; i++) {
        if (i > 0) {
          minXDelta = Math.min(minXDelta, xVals[i] - xVals[i - 1]);
        }
      }
    });
  }

  let alignedFrame = outerJoinDataFrames({
    frames,
    joinBy: dimFields.x,
    keep: dimFields.y,
    keepOriginIndices: true,
  });

  if (alignedFrame) {
    alignedFrame = applySpanNullsThresholds(alignedFrame, xField!.name);

    // append 2 null vals at minXDelta to bar series
    if (minXDelta !== Infinity) {
      alignedFrame.fields.forEach((f, fi) => {
        let vals = f.values;

        if (fi === 0) {
          let lastVal = vals[vals.length - 1];
          vals.push(lastVal + minXDelta, lastVal + 2 * minXDelta);
        } else if (isVisibleBarField(f)) {
          vals.push(null, null);
        } else {
          vals.push(undefined, undefined);
        }
      });

      alignedFrame.length += 2;
    }

    return alignedFrame;
  }

  return null;
}

export function buildScaleKey(config: FieldConfig<GraphFieldConfig>, fieldType: FieldType) {
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

  return `${scaleUnit}/${scaleRange}/${scaleSoftRange}/${scalePlacement}/${scaleDistribution}/${scaleLabel}/${fieldType}`;
}

function getScaleDistributionPart(config: ScaleDistributionConfig) {
  if (config.type === ScaleDistribution.Log) {
    return `${config.type}${config.log}`;
  }
  return config.type;
}
