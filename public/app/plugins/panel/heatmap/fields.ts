import {
  DataFrame,
  DataFrameType,
  Field,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  GrafanaTheme2,
  LinkModel,
  outerJoinDataFrames,
  PanelData,
  ValueFormatter,
  ValueLinkConfig,
} from '@grafana/data';
import { HeatmapCellLayout } from '@grafana/schema';
import {
  calculateHeatmapFromData,
  isHeatmapCellsDense,
  readHeatmapRowsCustomMeta,
  rowsToCellsHeatmap,
} from 'app/features/transformers/calculateHeatmap/heatmap';
import { parseSampleValue, sortSeriesByLabel } from 'app/plugins/datasource/prometheus/result_transformer';

import { CellValues, PanelOptions } from './types';
import { boundedMinMax } from './utils';

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

  xLog?: number;
  yLog?: number;

  xLogSplit?: number;
  yLogSplit?: number;

  // color scale range
  minValue?: number;
  maxValue?: number;

  // Print a heatmap cell value
  display?: (v: number) => string;

  // Errors
  warning?: string;
}

export function prepareHeatmapData(
  data: PanelData,
  options: PanelOptions,
  theme: GrafanaTheme2,
  getFieldLinks?: (exemplars: DataFrame, field: Field) => (config: ValueLinkConfig) => Array<LinkModel<Field>>
): HeatmapData {
  let frames = data.series;
  if (!frames?.length) {
    return {};
  }

  const exemplars = data.annotations?.find((f) => f.name === 'exemplar');

  if (getFieldLinks) {
    exemplars?.fields.forEach((field, index) => {
      exemplars.fields[index].getLinks = getFieldLinks(exemplars, field);
    });
  }

  if (options.calculate) {
    return getDenseHeatmapData(calculateHeatmapFromData(frames, options.calculation ?? {}), exemplars, options, theme);
  }

  // Check for known heatmap types
  let rowsHeatmap: DataFrame | undefined = undefined;
  for (const frame of frames) {
    switch (frame.meta?.type) {
      case DataFrameType.HeatmapCells:
        return isHeatmapCellsDense(frame)
          ? getDenseHeatmapData(frame, exemplars, options, theme)
          : getSparseHeatmapData(frame, exemplars, options, theme);

      case DataFrameType.HeatmapRows:
        rowsHeatmap = frame; // the default format
    }
  }

  // Everything past here assumes a field for each row in the heatmap (buckets)
  if (!rowsHeatmap) {
    if (frames.length > 1) {
      let allNamesNumeric = frames.every(
        (frame) => !Number.isNaN(parseSampleValue(frame.name ?? frame.fields[1].name))
      );

      if (allNamesNumeric) {
        frames.sort(sortSeriesByLabel);
      }

      rowsHeatmap = [
        outerJoinDataFrames({
          frames,
        })!,
      ][0];
    } else {
      rowsHeatmap = frames[0];
    }
  }

  return getDenseHeatmapData(
    rowsToCellsHeatmap({
      unit: options.yAxis?.unit, // used to format the ordinal lookup values
      decimals: options.yAxis?.decimals,
      ...options.rowsFrame,
      frame: rowsHeatmap,
    }),
    exemplars,
    options,
    theme
  );
}

const getSparseHeatmapData = (
  frame: DataFrame,
  exemplars: DataFrame | undefined,
  options: PanelOptions,
  theme: GrafanaTheme2
): HeatmapData => {
  if (frame.meta?.type !== DataFrameType.HeatmapCells || isHeatmapCellsDense(frame)) {
    return {
      warning: 'Expected sparse heatmap format',
      heatmap: frame,
    };
  }

  // y axis tick label display
  updateFieldDisplay(frame.fields[1], options.yAxis, theme);

  // cell value display
  const disp = updateFieldDisplay(frame.fields[3], options.cellValues, theme);

  let [minValue, maxValue] = boundedMinMax(
    frame.fields[3].values.toArray(),
    options.color.min,
    options.color.max,
    options.filterValues?.le,
    options.filterValues?.ge
  );

  return {
    heatmap: frame,
    minValue,
    maxValue,
    exemplars,
    display: (v) => formattedValueToString(disp(v)),
  };
};

const getDenseHeatmapData = (
  frame: DataFrame,
  exemplars: DataFrame | undefined,
  options: PanelOptions,
  theme: GrafanaTheme2
): HeatmapData => {
  if (frame.meta?.type !== DataFrameType.HeatmapCells) {
    return {
      warning: 'Expected heatmap scanlines format',
      heatmap: frame,
    };
  }

  if (frame.fields.length < 2 || frame.length < 2) {
    return { heatmap: frame };
  }

  const meta = readHeatmapRowsCustomMeta(frame);
  let xName: string | undefined = undefined;
  let yName: string | undefined = undefined;
  let valueField: Field | undefined = undefined;

  // validate field display properties
  for (const field of frame.fields) {
    switch (field.name) {
      case 'y':
        yName = field.name;

      case 'yMin':
      case 'yMax': {
        if (!yName) {
          yName = field.name;
        }
        if (meta.yOrdinalDisplay == null) {
          updateFieldDisplay(field, options.yAxis, theme);
        }
        break;
      }

      case 'x':
      case 'xMin':
      case 'xMax':
        xName = field.name;
        break;

      default: {
        if (field.type === FieldType.number && !valueField) {
          valueField = field;
        }
      }
    }
  }

  if (!yName) {
    return { warning: 'Missing Y field', heatmap: frame };
  }
  if (!yName) {
    return { warning: 'Missing X field', heatmap: frame };
  }
  if (!valueField) {
    return { warning: 'Missing value field', heatmap: frame };
  }

  const disp = updateFieldDisplay(valueField, options.cellValues, theme);

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

  let [minValue, maxValue] = boundedMinMax(
    valueField.values.toArray(),
    options.color.min,
    options.color.max,
    options.filterValues?.le,
    options.filterValues?.ge
  );

  let calcX = options.calculation?.xBuckets;
  let calcY = options.calculation?.yBuckets;

  const data: HeatmapData = {
    heatmap: frame,
    exemplars: exemplars?.length ? exemplars : undefined,
    xBucketSize: xBinIncr,
    yBucketSize: yBinIncr,
    xBucketCount: xBinQty,
    yBucketCount: yBinQty,

    yLog: calcY?.scale?.log ?? 0,
    xLog: calcX?.scale?.log ?? 0,

    xLogSplit: calcX?.scale?.log ? +(calcX?.value ?? '1') : 1,
    yLogSplit: calcY?.scale?.log ? +(calcY?.value ?? '1') : 1,

    minValue,
    maxValue,

    // TODO: improve heuristic
    xLayout:
      xName === 'xMax' ? HeatmapCellLayout.le : xName === 'xMin' ? HeatmapCellLayout.ge : HeatmapCellLayout.unknown,
    yLayout:
      yName === 'yMax' ? HeatmapCellLayout.le : yName === 'yMin' ? HeatmapCellLayout.ge : HeatmapCellLayout.unknown,

    display: (v) => formattedValueToString(disp(v)),
  };

  return data;
};

function updateFieldDisplay(field: Field, opts: CellValues | undefined, theme: GrafanaTheme2): ValueFormatter {
  if (opts?.unit?.length || opts?.decimals != null) {
    const { unit, decimals } = opts;
    field.display = undefined;
    field.config = { ...field.config };
    if (unit?.length) {
      field.config.unit = unit;
    }
    if (decimals != null) {
      field.config.decimals = decimals;
    }
  }
  if (!field.display) {
    field.display = getDisplayProcessor({ field, theme });
  }
  return field.display;
}
