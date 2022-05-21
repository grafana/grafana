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

import { HeatmapSourceMode, PanelOptions } from './models.gen';

export const enum BucketLayout {
  le = 'le',
  ge = 'ge',
}

export const HEATMAP_NOT_SCANLINES_ERROR = 'A calculated heatmap was expected, but not found';

export interface HeatmapData {
  // List of heatmap frames
  heatmap?: DataFrame;
  exemplars?: DataFrame;

  yAxisValues?: Array<number | string | null>;
  matchByLabel?: string; // e.g. le, pod, etc.
  labelValues?: string[]; // matched ordinally to yAxisValues

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

  const { source } = options;

  const exemplars = data.annotations?.find((f) => f.name === 'exemplar');

  const firstLabels = data.series[0].fields.find((f) => f.type === FieldType.number)?.labels ?? {};
  const matchByLabel = Object.keys(firstLabels)[0];

  if (source === HeatmapSourceMode.Calculate) {
    // TODO, check for error etc
    return getHeatmapData(calculateHeatmapFromData(frames, options.heatmap ?? {}), exemplars, theme);
  }

  const sparseCellsHeatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapSparse);
  if (sparseCellsHeatmap) {
    return getSparseHeatmapData(sparseCellsHeatmap, exemplars, theme);
  }

  // Find a well defined heatmap
  const scanlinesHeatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapScanlines);
  if (scanlinesHeatmap) {
    return getHeatmapData(scanlinesHeatmap, exemplars, theme);
  }

  const bucketsHeatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapBuckets);
  if (bucketsHeatmap) {
    return {
      matchByLabel,
      labelValues: frames[0].fields.flatMap((field) =>
        field.type === FieldType.number ? field.labels?.[matchByLabel] ?? [] : []
      ),
      yAxisValues: frames[0].fields.flatMap((field) =>
        field.type === FieldType.number ? getFieldDisplayName(field, frames[0], frames) : []
      ),
      ...getHeatmapData(bucketsToScanlines(bucketsHeatmap), exemplars, theme),
    };
  }

  if (source === HeatmapSourceMode.Data) {
    if (frames.length > 1) {
      // heatmap-buckets (labeled, no de-accum)
      frames = [
        outerJoinDataFrames({
          frames,
        })!,
      ];
    }

    const scanlinesFrame = bucketsToScanlines(frames[0]);
    const yAxisValues = frames[0].fields.flatMap((field) =>
      field.type === FieldType.number ? getFieldDisplayName(field, frames[0], frames) : []
    );

    return {
      matchByLabel,
      labelValues: frames[0].fields.flatMap((field) =>
        field.type === FieldType.number ? field.labels?.[matchByLabel] ?? [] : []
      ),
      yAxisValues,
      ...getHeatmapData(scanlinesFrame, exemplars, theme),
    };
  }

  // TODO, check for error etc
  return getHeatmapData(calculateHeatmapFromData(frames, options.heatmap ?? {}), exemplars, theme);
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
    xLayout: xName === 'xMax' ? BucketLayout.le : xName === 'xMin' ? BucketLayout.ge : BucketLayout.unk,
    yLayout: yName === 'yMax' ? BucketLayout.le : yName === 'yMin' ? BucketLayout.ge : BucketLayout.unk,

    display: (v) => formattedValueToString(disp(v)),
  };

  return data;
};
