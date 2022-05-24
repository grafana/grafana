import {
  DataFrame,
  DataFrameType,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  getValueFormat,
  GrafanaTheme2,
  outerJoinDataFrames,
  PanelData,
} from '@grafana/data';
import { calculateHeatmapFromData, bucketsToScanlines } from 'app/features/transformers/calculateHeatmap/heatmap';

import { HeatmapMode, PanelOptions } from './models.gen';

export const enum BucketLayout {
  le = 'le',
  ge = 'ge',
  unknown = 'unknown', // unknown
}

export interface HeatmapData {
  heatmap?: DataFrame; // data we will render
  exemplars?: DataFrame; // optionally linked exemplars
  exemplarColor?: string;

  yAxisValues?: Array<number | string | null>;
  yLabelValues?: string[]; // matched ordinally to yAxisValues
  matchByLabel?: string; // e.g. le, pod, etc.

  xBucketSize?: number;
  yBucketSize?: number;

  xBucketCount?: number;
  yBucketCount?: number;

  xLayout?: BucketLayout;
  yLayout?: BucketLayout;

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

  const { mode } = options;

  const exemplars = data.annotations?.find((f) => f.name === 'exemplar');

  if (mode === HeatmapMode.Calculate) {
    // TODO, check for error etc
    return getHeatmapData(calculateHeatmapFromData(frames, options.calculate ?? {}), exemplars, theme);
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

  // Some datasources return values in ascending order and require math to know the deltas
  if (mode === HeatmapMode.Accumulated) {
    console.log('TODO, deaccumulate the values');
  }

  const yFields = bucketHeatmap.fields.filter((f) => f.type === FieldType.number);
  const matchByLabel = Object.keys(yFields[0].labels ?? {})[0];

  const scanlinesFrame = bucketsToScanlines(bucketHeatmap);
  return {
    matchByLabel,
    yLabelValues: matchByLabel ? yFields.map((f) => f.labels?.[matchByLabel] ?? '') : undefined,
    yAxisValues: yFields.map((f) => getFieldDisplayName(f, bucketHeatmap, frames)),
    ...getHeatmapData(scanlinesFrame, exemplars, theme),
  };
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
    xLayout: xName === 'xMax' ? BucketLayout.le : xName === 'xMin' ? BucketLayout.ge : BucketLayout.unknown,
    yLayout: yName === 'yMax' ? BucketLayout.le : yName === 'yMin' ? BucketLayout.ge : BucketLayout.unknown,

    display: (v) => formattedValueToString(disp(v)),
  };

  return data;
};
