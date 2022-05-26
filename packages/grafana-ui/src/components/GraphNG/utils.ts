import {
  DataFrame,
  Field,
  FieldConfig,
  FieldType,
  outerJoinDataFrames,
  TimeRange,
  applyNullInsertThreshold,
  applySpanNullsThresholds,
} from '@grafana/data';
import {
  AxisPlacement,
  GraphDrawStyle,
  GraphFieldConfig,
  ScaleDistribution,
  ScaleDistributionConfig,
} from '@grafana/schema';

import { FIXED_UNIT } from './GraphNG';
import { XYFieldMatchers } from './types';

function isVisibleBarField(f: Field) {
  return (
    f.type === FieldType.number && f.config.custom?.drawStyle === GraphDrawStyle.Bars && !f.config.custom?.hideFrom?.viz
  );
}

export function preparePlotFrame(frames: DataFrame[], dimFields: XYFieldMatchers, timeRange?: TimeRange | null) {
  // apply null insertions at interval
  frames = frames.map((frame) => applyNullInsertThreshold({ frame, refFieldPseudoMax: timeRange?.to.valueOf() }));

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

      const xVals = frame.fields[0].values.toArray();

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
    alignedFrame = applySpanNullsThresholds(alignedFrame, isVisibleBarField);

    // append 2 null vals at minXDelta to bar series
    if (minXDelta !== Infinity) {
      alignedFrame.fields.forEach((f, fi) => {
        let vals = f.values.toArray();

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
