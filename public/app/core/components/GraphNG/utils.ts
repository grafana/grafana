import { DataFrame, Field, FieldType, outerJoinDataFrames, TimeRange, applyNullInsertThreshold } from '@grafana/data';
import { NULL_EXPAND, NULL_REMOVE, NULL_RETAIN, nullToUndefThreshold } from '@grafana/data/internal';
import { GraphDrawStyle } from '@grafana/schema';

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

  let numBarSeries = frames.reduce(
    (acc, frame) => acc + frame.fields.reduce((acc, field) => acc + (isVisibleBarField(field) ? 1 : 0), 0),
    0
  );

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

    // the join transformer force-deletes our state.displayName cache unless keepDisplayNames: true
    // https://github.com/grafana/grafana/pull/31121
    // https://github.com/grafana/grafana/pull/71806
    keepDisplayNames: true,

    // prevent minesweeper-expansion of nulls (gaps) when joining bars
    // since bar width is determined from the minimum distance between non-undefined values
    // (this strategy will still retain any original pre-join nulls, though)
    nullMode: (field) => {
      if (isVisibleBarField(field)) {
        return NULL_RETAIN;
      }

      let spanNulls = field.config.custom?.spanNulls;
      return spanNulls === true ? NULL_REMOVE : spanNulls === -1 ? NULL_RETAIN : NULL_EXPAND;
    },
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
