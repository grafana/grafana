import {
  DataFrame,
  DataFrameType,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  getValueFormat,
  GrafanaTheme2,
} from '@grafana/data';
import { calculateHeatmapFromData, rowsToCellsDense } from 'app/features/transformers/calculateHeatmap/heatmap';
import { HeatmapSourceMode, PanelOptions } from './models.gen';

export const enum BucketLayout {
  le = 'le',
  ge = 'ge',
}

export interface HeatmapDataDense {
  // List of heatmap frames
  heatmap?: DataFrame;

  yAxisValues?: Array<number | string | null>;

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

export interface HeatmapDataSparse {
  // List of heatmap frames
  heatmap?: DataFrame;

  // Print a heatmap cell value
  display?: (v: number) => string;

  // Errors
  warning?: string;
}

export function prepareHeatmapData(
  frames: DataFrame[] | undefined,
  options: PanelOptions,
  theme: GrafanaTheme2
): HeatmapDataDense | HeatmapDataSparse {
  if (!frames?.length) {
    return {};
  }

  const { source } = options;
  if (source === HeatmapSourceMode.Calculate) {
    // TODO, check for error etc
    return getHeatmapDense(calculateHeatmapFromData(frames, options.heatmap ?? {}), theme);
  }

  let sparseCellsHeatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapCellsSparse);
  if (sparseCellsHeatmap) {
    return getHeatmapSparse(sparseCellsHeatmap, theme);
  }

  // Find a well defined heatmap
  let denseCellsHeatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapCellsDense);
  if (denseCellsHeatmap) {
    return getHeatmapDense(denseCellsHeatmap, theme);
  }

  let denseRowsHeatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapRowsDense);
  if (denseRowsHeatmap) {
    return {
      yAxisValues: frames[0].fields.flatMap((field) =>
        field.type === FieldType.number ? getFieldDisplayName(field) : []
      ),
      ...getHeatmapDense(rowsToCellsDense(denseRowsHeatmap), theme),
    };
  }

  if (source === HeatmapSourceMode.Data) {
    return getHeatmapDense(rowsToCellsDense(frames[0]), theme);
  }

  // TODO, check for error etc
  return getHeatmapDense(calculateHeatmapFromData(frames, options.heatmap ?? {}), theme);
}

const getHeatmapDense = (frame: DataFrame, theme: GrafanaTheme2): HeatmapDataDense => {
  if (frame.meta?.type !== DataFrameType.HeatmapCellsDense) {
    return {
      warning: 'Expected heatmap-cells-dense format',
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
  // the 'heatmap-cells-dense' dense frame format looks like:
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
  return {
    heatmap: frame,
    xBucketSize: xBinIncr,
    yBucketSize: yBinIncr,
    xBucketCount: xBinQty,
    yBucketCount: yBinQty,

    // TODO: improve heuristic
    xLayout: frame.fields[0].name === 'xMax' ? BucketLayout.le : BucketLayout.ge,
    yLayout: frame.fields[1].name === 'yMax' ? BucketLayout.le : BucketLayout.ge,

    display: (v) => formattedValueToString(disp(v)),
  };
};

// assumes it's prepared
const getHeatmapSparse = (frame: DataFrame, theme: GrafanaTheme2): HeatmapDataDense => {
  if (frame.meta?.type !== DataFrameType.HeatmapCellsSparse) {
    return {
      warning: 'Expected heatmap sparse format',
      heatmap: frame,
    };
  }

  // The "count" field
  const disp = frame.fields[3].display ?? getValueFormat('short');
  return {
    heatmap: frame,
    display: (v) => formattedValueToString(disp(v)),
  };
};
