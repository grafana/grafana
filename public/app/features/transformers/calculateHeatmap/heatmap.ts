import { map } from 'rxjs';

import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  FieldType,
  incrRoundUp,
  incrRoundDn,
  SynchronousDataTransformerInfo,
  DataFrameType,
  getFieldDisplayName,
  Field,
} from '@grafana/data';

import { HeatmapCalculationMode, HeatmapCalculationOptions } from './models.gen';
import { niceLinearIncrs, niceTimeIncrs } from './utils';

export interface HeatmapTransformerOptions extends HeatmapCalculationOptions {
  /** the raw values will still exist in results after transformation */
  keepOriginalData?: boolean;
}

export const heatmapTransformer: SynchronousDataTransformerInfo<HeatmapTransformerOptions> = {
  id: DataTransformerID.heatmap,
  name: 'Create heatmap',
  description: 'calculate heatmap from source data',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(map((data) => heatmapTransformer.transformer(options)(data))),

  transformer: (options: HeatmapTransformerOptions) => {
    return (data: DataFrame[]) => {
      const v = calculateHeatmapFromData(data, options);
      if (options.keepOriginalData) {
        return [v, ...data];
      }
      return [v];
    };
  },
};

function parseNumeric(v?: string | null) {
  return v === '+Inf' ? Infinity : v === '-Inf' ? -Infinity : +(v ?? 0);
}

export function sortAscStrInf(aName?: string | null, bName?: string | null) {
  return parseNumeric(aName) - parseNumeric(bName);
}

/** Given existing buckets, create a values style frame */
// Assumes frames have already been sorted ASC and de-accumulated.
export function bucketsToScanlines(frame: DataFrame): DataFrame {
  // TODO: handle null-filling w/ fields[0].config.interval?
  const xField = frame.fields[0];
  const xValues = xField.values.toArray();
  const yField = frame.fields[1];

  // similar to initBins() below
  const len = xValues.length * (frame.fields.length - 1);
  const xs = new Array(len);
  const ys = new Array(len);
  const counts2 = new Array(len);

  const counts = frame.fields.slice(1).map((field) => field.values.toArray().slice());

  // transpose
  counts.forEach((bucketCounts, bi) => {
    for (let i = 0; i < bucketCounts.length; i++) {
      counts2[counts.length * i + bi] = bucketCounts[i];
    }
  });

  const bucketBounds = Array.from({ length: frame.fields.length - 1 }, (v, i) => i);

  // fill flat/repeating array
  for (let i = 0, yi = 0, xi = 0; i < len; yi = ++i % bucketBounds.length) {
    ys[i] = bucketBounds[yi];

    if (yi === 0 && i >= bucketBounds.length) {
      xi++;
    }

    xs[i] = xValues[xi];
  }

  return {
    length: xs.length,
    meta: {
      type: DataFrameType.HeatmapScanlines,
    },
    fields: [
      {
        name: 'xMax',
        type: xField.type,
        values: new ArrayVector(xs),
        config: xField.config,
      },
      {
        // this name determines whether cells are drawn above, below, or centered on the values
        name: yField.labels?.le != null ? 'yMax' : 'y',
        type: FieldType.number,
        values: new ArrayVector(ys),
        config: yField.config,
      },
      {
        name: 'count',
        type: FieldType.number,
        values: new ArrayVector(counts2),
        config: {
          unit: 'short',
        },
      },
    ],
  };
}

// Sorts frames ASC by numeric bucket name and de-accumulates values in each frame's Value field [1]
// similar to Prometheus result_transformer.ts -> transformToHistogramOverTime()
export function prepBucketFrames(frames: DataFrame[]): DataFrame[] {
  frames = frames.slice();

  // sort ASC by frame.name (Prometheus bucket bound)
  // or use frame.fields[1].config.displayNameFromDS ?
  frames.sort((a, b) => sortAscStrInf(a.name, b.name));

  // cumulative counts
  const counts = frames.map((frame) => frame.fields[1].values.toArray().slice());

  // de-accumulate
  counts.reverse();
  counts.forEach((bucketCounts, bi) => {
    if (bi < counts.length - 1) {
      for (let i = 0; i < bucketCounts.length; i++) {
        bucketCounts[i] -= counts[bi + 1][i];
      }
    }
  });
  counts.reverse();

  return frames.map((frame, i) => ({
    ...frame,
    fields: [
      frame.fields[0],
      {
        ...frame.fields[1],
        values: new ArrayVector(counts[i]),
      },
    ],
  }));
}

export function calculateHeatmapFromData(frames: DataFrame[], options: HeatmapCalculationOptions): DataFrame {
  //console.time('calculateHeatmapFromData');

  let xs: number[] = [];
  let ys: number[] = [];

  // optimization
  //let xMin = Infinity;
  //let xMax = -Infinity;

  let xField: Field | undefined = undefined;
  let yField: Field | undefined = undefined;

  for (let frame of frames) {
    // TODO: assumes numeric timestamps, ordered asc, without nulls
    const x = frame.fields.find((f) => f.type === FieldType.time);
    if (!x) {
      continue;
    }

    if (!xField) {
      xField = x; // the first X
    }

    const xValues = x.values.toArray();
    for (let field of frame.fields) {
      if (field !== x && field.type === FieldType.number) {
        xs = xs.concat(xValues);
        ys = ys.concat(field.values.toArray());

        if (!yField) {
          yField = field;
        }
      }
    }
  }

  if (!xField || !yField) {
    throw 'no heatmap fields found';
  }

  if (!xs.length || !ys.length) {
    throw 'no values found';
  }

  const heat2d = heatmap(xs, ys, {
    xSorted: true,
    xTime: xField.type === FieldType.time,
    xMode: options.xAxis?.mode,
    xSize: +(options.xAxis?.value ?? 0),
    yMode: options.yAxis?.mode,
    ySize: +(options.yAxis?.value ?? 0),
  });

  const frame = {
    length: heat2d.x.length,
    name: getFieldDisplayName(yField),
    meta: {
      type: DataFrameType.HeatmapScanlines,
    },
    fields: [
      {
        name: 'xMin',
        type: xField.type,
        values: new ArrayVector(heat2d.x),
        config: xField.config,
      },
      {
        name: 'yMin',
        type: FieldType.number,
        values: new ArrayVector(heat2d.y),
        config: yField.config, // keep units from the original source
      },
      {
        name: 'count',
        type: FieldType.number,
        values: new ArrayVector(heat2d.count),
        config: {
          unit: 'short', // always integer
        },
      },
    ],
  };

  //console.timeEnd('calculateHeatmapFromData');

  //console.log({ tiles: frame.length });

  return frame;
}

interface HeatmapOpts {
  // default is 10% of data range, snapped to a "nice" increment
  xMode?: HeatmapCalculationMode;
  yMode?: HeatmapCalculationMode;
  xSize?: number;
  ySize?: number;

  // use Math.ceil instead of Math.floor for bucketing
  xCeil?: boolean;
  yCeil?: boolean;

  // log2 or log10 buckets
  xLog?: 2 | 10;
  yLog?: 2 | 10;

  xTime?: boolean;
  yTime?: boolean;

  // optimization hints for known data ranges (sorted, pre-scanned, etc)
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;

  xSorted?: boolean;
  ySorted?: boolean;
}

// TODO: handle NaN, Inf, -Inf, null, undefined values in xs & ys
function heatmap(xs: number[], ys: number[], opts?: HeatmapOpts) {
  let len = xs.length;

  let xSorted = opts?.xSorted ?? false;
  let ySorted = opts?.ySorted ?? false;

  // find x and y limits to pre-compute buckets struct
  let minX = xSorted ? xs[0] : Infinity;
  let minY = ySorted ? ys[0] : Infinity;
  let maxX = xSorted ? xs[len - 1] : -Infinity;
  let maxY = ySorted ? ys[len - 1] : -Infinity;

  for (let i = 0; i < len; i++) {
    if (!xSorted) {
      minX = Math.min(minX, xs[i]);
      maxX = Math.max(maxX, xs[i]);
    }

    if (!ySorted) {
      minY = Math.min(minY, ys[i]);
      maxY = Math.max(maxY, ys[i]);
    }
  }

  //let scaleX = opts?.xLog === 10 ? Math.log10 : opts?.xLog === 2 ? Math.log2 : (v: number) => v;
  //let scaleY = opts?.yLog === 10 ? Math.log10 : opts?.yLog === 2 ? Math.log2 : (v: number) => v;

  let xBinIncr = opts?.xSize ?? 0;
  let yBinIncr = opts?.ySize ?? 0;
  let xMode = opts?.xMode;
  let yMode = opts?.yMode;

  // fall back to 10 buckets if invalid settings
  if (!Number.isFinite(xBinIncr) || xBinIncr <= 0) {
    xMode = HeatmapCalculationMode.Count;
    xBinIncr = 20;
  }
  if (!Number.isFinite(yBinIncr) || yBinIncr <= 0) {
    yMode = HeatmapCalculationMode.Count;
    yBinIncr = 10;
  }

  if (xMode === HeatmapCalculationMode.Count) {
    // TODO: optionally use view range min/max instead of data range for bucket sizing
    let approx = (maxX - minX) / Math.max(xBinIncr - 1, 1);
    // nice-ify
    let xIncrs = opts?.xTime ? niceTimeIncrs : niceLinearIncrs;
    let xIncrIdx = xIncrs.findIndex((bucketSize) => bucketSize > approx) - 1;
    xBinIncr = xIncrs[Math.max(xIncrIdx, 0)];
  }

  if (yMode === HeatmapCalculationMode.Count) {
    // TODO: optionally use view range min/max instead of data range for bucket sizing
    let approx = (maxY - minY) / Math.max(yBinIncr - 1, 1);
    // nice-ify
    let yIncrs = opts?.yTime ? niceTimeIncrs : niceLinearIncrs;
    let yIncrIdx = yIncrs.findIndex((bucketSize) => bucketSize > approx) - 1;
    yBinIncr = yIncrs[Math.max(yIncrIdx, 0)];
  }

  // console.log({
  //   yBinIncr,
  //   xBinIncr,
  // });

  let binX = opts?.xCeil ? (v: number) => incrRoundUp(v, xBinIncr) : (v: number) => incrRoundDn(v, xBinIncr);
  let binY = opts?.yCeil ? (v: number) => incrRoundUp(v, yBinIncr) : (v: number) => incrRoundDn(v, yBinIncr);

  let minXBin = binX(minX);
  let maxXBin = binX(maxX);
  let minYBin = binY(minY);
  let maxYBin = binY(maxY);

  let xBinQty = Math.round((maxXBin - minXBin) / xBinIncr) + 1;
  let yBinQty = Math.round((maxYBin - minYBin) / yBinIncr) + 1;

  let [xs2, ys2, counts] = initBins(xBinQty, yBinQty, minXBin, xBinIncr, minYBin, yBinIncr);

  for (let i = 0; i < len; i++) {
    const xi = (binX(xs[i]) - minXBin) / xBinIncr;
    const yi = (binY(ys[i]) - minYBin) / yBinIncr;
    const ci = xi * yBinQty + yi;

    counts[ci]++;
  }

  return {
    x: xs2,
    y: ys2,
    count: counts,
  };
}

function initBins(xQty: number, yQty: number, xMin: number, xIncr: number, yMin: number, yIncr: number) {
  const len = xQty * yQty;
  const xs = new Array<number>(len);
  const ys = new Array<number>(len);
  const counts = new Array<number>(len);

  for (let i = 0, yi = 0, x = xMin; i < len; yi = ++i % yQty) {
    counts[i] = 0;
    ys[i] = yMin + yi * yIncr;

    if (yi === 0 && i >= yQty) {
      x += xIncr;
    }

    xs[i] = x;
  }

  return [xs, ys, counts];
}
