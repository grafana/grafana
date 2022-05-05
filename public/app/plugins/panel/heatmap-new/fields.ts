import { cloneDeep } from 'lodash';

import {
  DataFrame,
  DataFrameType,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  getValueFormat,
  GrafanaTheme2,
  Field,
  ArrayVector,
  incrRoundUp,
  incrRoundDn,
  PanelData,
} from '@grafana/data';
import { calculateHeatmapFromData, bucketsToScanlines } from 'app/features/transformers/calculateHeatmap/heatmap';

import { HeatmapSourceMode, PanelOptions } from './models.gen';
import { quantizeScheme } from './palettes';
import { findDataFramesInPanelData, findExemplarFrameInPanelData, getDataMapping, getHeatmapFields } from './utils';

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

  // Print a heatmap cell value
  display?: (v: number) => string;

  // Errors
  warning?: string;
}

export function calculatUsingExistingHeatmap(frame: DataFrame, reference: HeatmapData): HeatmapData {
  const clone = cloneDeep<HeatmapData>(reference);
  let [fxs, fys, fcounts] = getHeatmapFields(clone.heatmap!);
  const xos = frame.fields.find((f: Field) => f.type === 'time')?.values.toArray();
  const yos = frame.fields.find((f: Field) => f.type === 'number')?.values.toArray();

  if (xos && yos && fcounts && fxs && fys && clone.heatmap) {
    const xsmin = fxs.state?.calcs?.min ?? fxs.state?.range?.min ?? fxs.values.get(0);
    const ysmin = fys.state?.calcs?.min ?? fys.state?.range?.min ?? fys.values.get(0);
    const xsmax = xsmin + clone.xBucketSize! * clone.xBucketCount!;
    const ysmax = ysmin + clone.yBucketSize! * clone.yBucketCount!;
    let counts = fcounts.values.toArray().fill(0);
    for (let i = 0; i < xos.length; i++) {
      const xo = xos[i];
      const yo = yos[i];
      const xBucketIdx = Math.floor(incrRoundDn(incrRoundUp((xo - xsmin) / clone.xBucketSize!, 1e-7), 1e-7));
      const yBucketIdx = Math.floor(incrRoundDn(incrRoundUp((yo - ysmin) / clone.yBucketSize!, 1e-7), 1e-7));

      if (xo < xsmin || xo > xsmax) {
        continue;
      }

      if (yo < ysmin || yo > ysmax) {
        continue;
      }

      const index = xBucketIdx * clone.yBucketCount! + yBucketIdx;
      counts[index]++;
    }
    clone.heatmap.fields[2].values = new ArrayVector(counts);
  }

  return clone;
}

export function findAndPrepareHeatmapData(
  data: PanelData,
  options: PanelOptions,
  theme: GrafanaTheme2
): [HeatmapData, Array<number[] | null>, HeatmapData | undefined, Array<number[] | null>, string[]] {
  let exemplars: HeatmapData | undefined = undefined;
  let exemplarPalette: string[] = [];
  const infoFrame = findDataFramesInPanelData(data);
  const info = prepareHeatmapData(infoFrame!, options, theme);
  const infoMapping = getDataMapping(info, infoFrame?.[0]!, { requireCount: false });
  const exemplarsFrame: DataFrame | undefined = findExemplarFrameInPanelData(data);
  let exemplarMapping: Array<number[] | null> = [null];
  if (exemplarsFrame && info) {
    exemplars = calculatUsingExistingHeatmap(exemplarsFrame, info);
    // Use the mapping/geometry from the data heatmap
    exemplarMapping = getDataMapping(info, exemplarsFrame, { requireCount: false });
    const countMax = Math.max(...info.heatmap?.fields?.[2]?.values.toArray()!);
    exemplarPalette = quantizeScheme(
      {
        ...options.color,
        steps: countMax,
      },
      theme
    );
  }
  console.log('data', data, 'info', info, 'infoMapping', infoMapping);
  return [info, infoMapping, exemplars, exemplarMapping, exemplarPalette];
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
  let scanlinesHeatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapScanlines);
  if (scanlinesHeatmap) {
    return getHeatmapData(scanlinesHeatmap, theme);
  }

  let bucketsHeatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapBuckets);
  if (bucketsHeatmap) {
    return {
      yAxisValues: frames[0].fields.flatMap((field) =>
        field.type === FieldType.number ? getFieldDisplayName(field) : []
      ),
      ...getHeatmapData(bucketsToScanlines(bucketsHeatmap), theme),
    };
  }

  if (source === HeatmapSourceMode.Data) {
    return getHeatmapData(bucketsToScanlines(frames[0]), theme);
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
  // Round to 7 decimal places to get rid of any rounding errors
  let yBinIncr = incrRoundDn(incrRoundUp(ys[1] - ys[0], 1e-7), 1e-7);
  let xBinIncr = incrRoundDn(incrRoundUp(xs[yBinQty] - xs[0], 1e-7), 1e-7);

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
