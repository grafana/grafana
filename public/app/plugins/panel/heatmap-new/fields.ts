import {
  DataFrame,
  DataFrameType,
  Field,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  getValueFormat,
  GrafanaTheme2,
  incrRoundDn,
  incrRoundUp,
  PanelData,
} from '@grafana/data';
import { calculateHeatmapFromData, bucketsToScanlines } from 'app/features/transformers/calculateHeatmap/heatmap';

import { HeatmapSourceMode, PanelOptions } from './models.gen';

export const enum BucketLayout {
  le = 'le',
  ge = 'ge',
}

export interface HeatmapDataMapping {
  lookup: Array<number[] | null>;
  high: number[]; // index of values bigger than the max Y
  low: number[]; // index of values less than the min Y
}

export const HEATMAP_NOT_SCANLINES_ERROR = 'A calculated heatmap was expected, but not found';

export interface HeatmapData {
  // List of heatmap frames
  heatmap?: DataFrame;
  exemplars?: DataFrame;
  exemplarsMappings?: HeatmapDataMapping;

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

export function prepareHeatmapData(data: PanelData, options: PanelOptions, theme: GrafanaTheme2): HeatmapData {
  const frames = data.series;
  if (!frames?.length) {
    return {};
  }

  const { source } = options;

  const exemplars = data.annotations?.find((f) => f.name === 'exemplar');

  if (source === HeatmapSourceMode.Calculate) {
    // TODO, check for error etc
    return getHeatmapData(calculateHeatmapFromData(frames, options.heatmap ?? {}), exemplars, theme);
  }

  // Find a well defined heatmap
  let scanlinesHeatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapScanlines);
  if (scanlinesHeatmap) {
    return getHeatmapData(scanlinesHeatmap, exemplars, theme);
  }

  let bucketsHeatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapBuckets);
  if (bucketsHeatmap) {
    return {
      yAxisValues: frames[0].fields.flatMap((field) =>
        field.type === FieldType.number ? getFieldDisplayName(field) : []
      ),
      ...getHeatmapData(bucketsToScanlines(bucketsHeatmap), exemplars, theme),
    };
  }

  if (source === HeatmapSourceMode.Data) {
    return getHeatmapData(bucketsToScanlines(frames[0]), exemplars, theme);
  }

  // TODO, check for error etc
  return getHeatmapData(calculateHeatmapFromData(frames, options.heatmap ?? {}), exemplars, theme);
}

const getHeatmapFields = (dataFrame: DataFrame): Array<Field | undefined> => {
  const xField: Field | undefined = dataFrame.fields.find((f) => f.name === 'xMin');
  const yField: Field | undefined = dataFrame.fields.find((f) => f.name === 'yMin');
  const countField: Field | undefined = dataFrame.fields.find((f) => f.name === 'count');

  return [xField, yField, countField];
};

export const getExemplarsMapping = (heatmapData: HeatmapData, rawData: DataFrame): HeatmapDataMapping => {
  if (heatmapData.heatmap?.meta?.type !== DataFrameType.HeatmapScanlines) {
    throw HEATMAP_NOT_SCANLINES_ERROR;
  }

  const [fxs, fys] = getHeatmapFields(heatmapData.heatmap!);

  if (!fxs || !fys) {
    throw HEATMAP_NOT_SCANLINES_ERROR;
  }

  const mapping: HeatmapDataMapping = {
    lookup: new Array(heatmapData.xBucketCount! * heatmapData.yBucketCount!).fill(null),
    high: [],
    low: [],
  };

  const xos: number[] | undefined = rawData.fields.find((f: Field) => f.type === 'time')?.values.toArray();
  const yos: number[] | undefined = rawData.fields.find((f: Field) => f.type === 'number')?.values.toArray();

  if (!xos || !yos) {
    return mapping;
  }

  const xsmin = fxs.values.get(0);
  const ysmin = fys.values.get(0);
  const xsmax = fxs.values.get(fxs.values.length - 1) + heatmapData.xBucketSize!;
  const ysmax = fys.values.get(fys.values.length - 1) + heatmapData.yBucketSize!;
  xos.forEach((xo: number, i: number) => {
    const yo = yos[i];
    const xBucketIdx = Math.floor(incrRoundDn(incrRoundUp((xo - xsmin) / heatmapData.xBucketSize!, 1e-7), 1e-7));
    const yBucketIdx = Math.floor(incrRoundDn(incrRoundUp((yo - ysmin) / heatmapData.yBucketSize!, 1e-7), 1e-7));

    if (xo < xsmin || yo < ysmin) {
      mapping.low.push(i);
      return;
    }

    if (xo >= xsmax || yo >= ysmax) {
      mapping.high.push(i);
      return;
    }

    const index = xBucketIdx * heatmapData.yBucketCount! + yBucketIdx;
    if (mapping.lookup[index] === null) {
      mapping.lookup[index] = [];
    }
    mapping.lookup[index]?.push(i);
  });
  return mapping;
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
  const data: HeatmapData = {
    heatmap: frame,
    exemplars,
    xBucketSize: xBinIncr,
    yBucketSize: yBinIncr,
    xBucketCount: xBinQty,
    yBucketCount: yBinQty,

    // TODO: improve heuristic
    xLayout: frame.fields[0].name === 'xMax' ? BucketLayout.le : BucketLayout.ge,
    yLayout: frame.fields[1].name === 'yMax' ? BucketLayout.le : BucketLayout.ge,

    display: (v) => formattedValueToString(disp(v)),
  };

  if (exemplars) {
    data.exemplarsMappings = getExemplarsMapping(data, exemplars);
    console.log('EXEMPLARS', data.exemplarsMappings, data.exemplars);
  }

  return data;
};
