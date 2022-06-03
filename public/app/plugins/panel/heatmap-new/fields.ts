import {
  DataFrame,
  DataFrameType,
  formattedValueToString,
  getDisplayProcessor,
  getValueFormat,
  GrafanaTheme2,
  outerJoinDataFrames,
  PanelData,
} from '@grafana/data';
import { calculateHeatmapFromData, bucketsToScanlines } from 'app/features/transformers/calculateHeatmap/heatmap';
import { HeatmapBucketLayout } from 'app/features/transformers/calculateHeatmap/models.gen';

import { PanelOptions } from './models.gen';

export interface HeatmapData {
  heatmap?: DataFrame; // data we will render
  exemplars?: DataFrame; // optionally linked exemplars
  exemplarColor?: string;

  xBucketSize?: number;
  yBucketSize?: number;

  xBucketCount?: number;
  yBucketCount?: number;

  xLayout?: HeatmapBucketLayout;
  yLayout?: HeatmapBucketLayout;

  // Print a heatmap cell value
  display?: (v: number) => string;

  // Errors
  warning?: string;
}

export function prepareHeatmapData(data: PanelData, options: PanelOptions, theme: GrafanaTheme2): HeatmapData {
  let frames = data.series;
  if (!frames?.length) {
    return {};
  }

  const exemplars = data.annotations?.find((f) => f.name === 'exemplar');

  if (options.calculate) {
    // TODO, check for error etc
    return getHeatmapData(calculateHeatmapFromData(frames, options.calculation ?? {}), exemplars, theme);
  }

  // Check for known heatmap types
  let bucketHeatmap: DataFrame | undefined = undefined;
  for (const frame of frames) {
    switch (frame.meta?.type) {
      case DataFrameType.HeatmapSparse:
        return getSparseHeatmapData(frame, exemplars, theme);

      case DataFrameType.HeatmapScanlines:
        return getHeatmapData(frame, exemplars, theme);

      case DataFrameType.HeatmapBuckets:
        bucketHeatmap = frame; // the default format
    }
  }

  // Everything past here assumes a field for each row in the heatmap (buckets)
  if (!bucketHeatmap) {
    if (frames.length > 1) {
      bucketHeatmap = [
        outerJoinDataFrames({
          frames,
        })!,
      ][0];
    } else {
      bucketHeatmap = frames[0];
    }
  }

  return getHeatmapData(bucketsToScanlines({ ...options.bucket, frame: bucketHeatmap }), exemplars, theme);
}

const getSparseHeatmapData = (
  frame: DataFrame,
  exemplars: DataFrame | undefined,
  theme: GrafanaTheme2
): HeatmapData => {
  if (frame.meta?.type !== DataFrameType.HeatmapSparse) {
    return {
      warning: 'Expected sparse heatmap format',
      heatmap: frame,
    };
  }

  const disp = frame.fields[3].display ?? getValueFormat('short');
  return {
    heatmap: frame,
    exemplars,
    display: (v) => formattedValueToString(disp(v)),
  };
};

const getHeatmapData = (frame: DataFrame, exemplars: DataFrame | undefined, theme: GrafanaTheme2): HeatmapData => {
  if (frame.meta?.type !== DataFrameType.HeatmapScanlines) {
    return {
      warning: 'Expected heatmap scanlines format',
      heatmap: frame,
    };
  }

  if (frame.fields.length < 2 || frame.length < 2) {
    return { heatmap: frame };
  }

  // Y field values (display is used in the axis)
  if (!frame.fields[1].display) {
    frame.fields[1].display = getDisplayProcessor({ field: frame.fields[1], theme });
  }

  // infer bucket sizes from data (for now)
  // the 'heatmap-scanlines' dense frame format looks like:
  // x:      1,1,1,1,2,2,2,2
  // y:      3,4,5,6,3,4,5,6
  // count:  0,0,0,7,0,3,0,1

  const xs = frame.fields[0].values.toArray();
  const ys = frame.fields[1].values.toArray();
  const dlen = xs.length;

  // below is literally copy/paste from the pathBuilder code in utils.ts
  // detect x and y bin qtys by detecting layout repetition in x & y data
  let yBinQty = dlen - ys.lastIndexOf(ys[0]);
  let xBinQty = dlen / yBinQty;
  let yBinIncr = ys[1] - ys[0];
  let xBinIncr = xs[yBinQty] - xs[0];

  // The "count" field
  const disp = frame.fields[2].display ?? getValueFormat('short');
  const xName = frame.fields[0].name;
  const yName = frame.fields[1].name;

  const data: HeatmapData = {
    heatmap: frame,
    exemplars,
    xBucketSize: xBinIncr,
    yBucketSize: yBinIncr,
    xBucketCount: xBinQty,
    yBucketCount: yBinQty,

    // TODO: improve heuristic
    xLayout:
      xName === 'xMax'
        ? HeatmapBucketLayout.le
        : xName === 'xMin'
        ? HeatmapBucketLayout.ge
        : HeatmapBucketLayout.unknown,
    yLayout:
      yName === 'yMax'
        ? HeatmapBucketLayout.le
        : yName === 'yMin'
        ? HeatmapBucketLayout.ge
        : HeatmapBucketLayout.unknown,

    display: (v) => formattedValueToString(disp(v)),
  };

  return data;
};
