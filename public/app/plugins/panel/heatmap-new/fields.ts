import { DataFrame, DataFrameType, getDisplayProcessor, GrafanaTheme2 } from '@grafana/data';
import { calculateHeatmapFromData, createHeatmapFromBuckets } from 'app/features/transformers/calculateHeatmap/heatmap';
import { HeatmapSourceMode, PanelOptions } from './models.gen';

export const enum BucketLayout {
  le = 'le',
  ge = 'ge',
}

export interface HeatmapData {
  // List of heatmap frames
  heatmap?: DataFrame;

  yAxisValues?: Array<number | string | null>;

  xBucketSize?: number;
  yBucketSize?: number;

  xBucketCount?: number;
  yBucketCount?: number;

  xLayout?: BucketLayout;
  yLayout?: BucketLayout;

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
    return getHeatmapData(calculateHeatmapFromData(frames, options.heatmap ?? {}), theme);
  }

  // Find a well defined heatmap
  let heatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapScanlines);
  if (heatmap) {
    return getHeatmapData(heatmap, theme);
  }

  if (source === HeatmapSourceMode.Data) {
    // TODO: check for names xMin, yMin etc...
    return getHeatmapData(createHeatmapFromBuckets(frames), theme);
  }

  // detect a frame-per-bucket heatmap frame
  // TODO: improve heuristic? infer from fields[1].labels.le === '+Inf' ?
  if (frames[0].meta?.custom?.resultType === 'matrix' && frames.some((f) => f.name?.startsWith('+Inf'))) {
    // already done by the Prometheus datasource frontend
    //frames = prepBucketFrames(frames);

    return {
      yAxisValues: frames.map((f) => f.name ?? null),
      ...getHeatmapData(createHeatmapFromBuckets(frames), theme),
    };
  }

  // TODO, check for error etc
  return getHeatmapData(calculateHeatmapFromData(frames, options.heatmap ?? {}), theme);
}

const getHeatmapData = (frame: DataFrame, theme: GrafanaTheme2): HeatmapData => {
  if (frame.meta?.type !== DataFrameType.HeatmapScanlines) {
    return {
      warning: 'Expected heatmap scanlines format',
      heatmap: frame,
    };
  }

  if (frame.fields.length < 2 || frame.length < 2) {
    return { heatmap: frame };
  }

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

  return {
    heatmap: frame,
    xBucketSize: xBinIncr,
    yBucketSize: yBinIncr,
    xBucketCount: xBinQty,
    yBucketCount: yBinQty,
    // TODO: improve heuristic
    xLayout: frame.fields[0].name === 'xMax' ? BucketLayout.le : BucketLayout.ge,
    yLayout: frame.fields[1].name === 'yMax' ? BucketLayout.le : BucketLayout.ge,
  };
};
