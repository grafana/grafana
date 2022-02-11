import { DataFrame, DataFrameType, GrafanaTheme2 } from '@grafana/data';
import {
  calculateHeatmapFromData,
  createHeatmapFromBuckets,
} from 'app/core/components/TransformersUI/calculateHeatmap/heatmap';
import { HeatmapSourceMode, PanelOptions } from './models.gen';

export interface HeatmapData {
  // List of heatmap frames
  heatmap?: DataFrame;

  xBucketSize?: number;
  yBucketSize?: number;

  xBucketCount?: number;
  yBucketCount?: number;

  // Errors
  warning?: string;
}

export function prepareHeatmapData(
  frames: DataFrame[] | undefined,
  options: PanelOptions,
  theme: GrafanaTheme2
): HeatmapData {
  if (!frames?.length) {
    return {};
  }

  const { source } = options;
  if (source === HeatmapSourceMode.Calculate) {
    // TODO, check for error etc
    return getHeatmapData(calculateHeatmapFromData(frames, options.heatmap ?? {}));
  }

  // Find a well defined heatmap
  let heatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapScanLines);
  if (heatmap) {
    return getHeatmapData(heatmap);
  }

  if (source === HeatmapSourceMode.Data) {
    // TODO: check for names xMin, yMin etc...
    return getHeatmapData(createHeatmapFromBuckets(frames));
  }

  // detect a frame-per-bucket heatmap frame
  // TODO: improve heuristic?
  if (frames[0].meta?.custom?.resultType === 'matrix' && frames.some((f) => f.name?.endsWith('Inf'))) {
    return getHeatmapData(createHeatmapFromBuckets(frames));
  }

  // TODO, check for error etc
  return getHeatmapData(calculateHeatmapFromData(frames, options.heatmap ?? {}));
}

const getHeatmapData = (frame: DataFrame): HeatmapData => {
  if (frame.fields.length < 2 || frame.length < 2) {
    return { heatmap: frame };
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

  return { heatmap: frame, xBucketSize: xBinIncr, yBucketSize: yBinIncr, xBucketCount: xBinQty, yBucketCount: yBinQty };
};
