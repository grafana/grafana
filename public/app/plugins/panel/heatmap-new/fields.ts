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
import { calculateHeatmapFromData, rowsToCellsHeatmap } from 'app/features/transformers/calculateHeatmap/heatmap';
import { HeatmapCellLayout } from 'app/features/transformers/calculateHeatmap/models.gen';

import { PanelOptions } from './models.gen';

export interface HeatmapData {
  heatmap?: DataFrame; // data we will render
  exemplars?: DataFrame; // optionally linked exemplars
  exemplarColor?: string;

  xBucketSize?: number;
  yBucketSize?: number;

  xBucketCount?: number;
  yBucketCount?: number;

  xLayout?: HeatmapCellLayout;
  yLayout?: HeatmapCellLayout;

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
    return getHeatmapData(
      calculateHeatmapFromData(frames, {
        ...options.calculation,
        yAxisConfig: options.yAxis,
      }),
      exemplars,
      theme
    );
  }

  // Check for known heatmap types
  let rowsHeatmap: DataFrame | undefined = undefined;
  for (const frame of frames) {
    switch (frame.meta?.type) {
      case DataFrameType.HeatmapSparse:
        return getSparseHeatmapData(frame, exemplars, theme);

      case DataFrameType.HeatmapCells:
        return getHeatmapData(frame, exemplars, theme);

      case DataFrameType.HeatmapRows:
        rowsHeatmap = frame; // the default format
    }
  }

  // Everything past here assumes a field for each row in the heatmap (buckets)
  if (!rowsHeatmap) {
    if (frames.length > 1) {
      rowsHeatmap = [
        outerJoinDataFrames({
          frames,
        })!,
      ][0];
    } else {
      rowsHeatmap = frames[0];
    }
  }

  return getHeatmapData(
    rowsToCellsHeatmap({
      unit: options.yAxis?.unit,
      decimals: options.yAxis?.decimals,
      ...options.rowsFrame,
      frame: rowsHeatmap,
    }),
    exemplars,
    theme
  );
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
  if (frame.meta?.type !== DataFrameType.HeatmapCells) {
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
    exemplars: exemplars?.length ? exemplars : undefined,
    xBucketSize: xBinIncr,
    yBucketSize: yBinIncr,
    xBucketCount: xBinQty,
    yBucketCount: yBinQty,

    // TODO: improve heuristic
    xLayout:
      xName === 'xMax' ? HeatmapCellLayout.le : xName === 'xMin' ? HeatmapCellLayout.ge : HeatmapCellLayout.unknown,
    yLayout:
      yName === 'yMax' ? HeatmapCellLayout.le : yName === 'yMin' ? HeatmapCellLayout.ge : HeatmapCellLayout.unknown,

    display: (v) => formattedValueToString(disp(v)),
  };

  return data;
};
