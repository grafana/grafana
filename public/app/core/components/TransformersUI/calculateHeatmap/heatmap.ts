import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  FieldType,
  incrRoundUp,
  incrRoundDn,
  SynchronousDataTransformerInfo,
} from '@grafana/data';
import { map } from 'rxjs';
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

export function calculateHeatmapFromData(frames: DataFrame[], options: HeatmapCalculationOptions): DataFrame {
  //console.time('calculateHeatmapFromData');

  let xs: number[] = [];
  let ys: number[] = [];

  // optimization
  //let xMin = Infinity;
  //let xMax = -Infinity;

  for (let frame of frames) {
    // TODO: assumes numeric timestamps, ordered asc, without nulls
    let timeValues = frame.fields.find((f) => f.type === FieldType.time)?.values.toArray();

    if (timeValues) {
      //xMin = Math.min(xMin, timeValues[0]);
      //xMax = Math.max(xMax, timeValues[timeValues.length - 1]);

      for (let field of frame.fields) {
        if (field.type === FieldType.number) {
          xs = xs.concat(timeValues);
          ys = ys.concat(field.values.toArray());
        }
      }
    }
  }

  let heat2d = heatmap(xs, ys, {
    xSorted: true,
    xTime: true,
    xUnit: options.xAxis?.mode,
    xSize: +(options.xAxis?.value ?? 0),
    yUnit: options.yAxis?.mode,
    ySize: +(options.yAxis?.value ?? 0),
  });

  let frame = {
    length: heat2d.x.length,
    fields: [
      {
        name: 'xMin',
        type: FieldType.time,
        values: new ArrayVector(heat2d.x),
        config: {},
      },
      {
        name: 'yMin',
        type: FieldType.number,
        values: new ArrayVector(heat2d.y),
        config: {},
      },
      {
        name: 'count',
        type: FieldType.number,
        values: new ArrayVector(heat2d.count),
        config: {},
      },
    ],
  };

  //console.timeEnd('calculateHeatmapFromData');

  //console.log({ tiles: frame.length });

  return frame;
}

interface HeatmapOpts {
  // default is 10% of data range, snapped to a "nice" increment
  xUnit?: HeatmapCalculationMode;
  yUnit?: HeatmapCalculationMode;
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

  let xBinIncr = opts?.xSize;
  let yBinIncr = opts?.ySize;
  let xUnit = opts?.xUnit;
  let yUnit = opts?.yUnit;

  // fall back to 10 buckets if invalid settings
  if (!Number.isFinite(xBinIncr) || xBinIncr <= 0) {
    xUnit = HeatmapCalculationMode.Count;
    xBinIncr = 20;
  }
  if (!Number.isFinite(yBinIncr) || yBinIncr <= 0) {
    yUnit = HeatmapCalculationMode.Count;
    yBinIncr = 10;
  }

  if (xUnit === HeatmapCalculationMode.Count) {
    // TODO: optionally use view range min/max instead of data range for bucket sizing
    let approx = (maxX - minX) / Math.max(xBinIncr - 1, 1);
    // nice-ify
    let xIncrs = opts?.xTime ? niceTimeIncrs : niceLinearIncrs;
    xBinIncr = xIncrs[xIncrs.findIndex((bucketSize) => bucketSize > approx) - 1];
  }

  if (yUnit === HeatmapCalculationMode.Count) {
    // TODO: optionally use view range min/max instead of data range for bucket sizing
    let approx = (maxY - minY) / Math.max(yBinIncr - 1, 1);
    // nice-ify
    let yIncrs = opts?.yTime ? niceTimeIncrs : niceLinearIncrs;
    yBinIncr = yIncrs[yIncrs.findIndex((bucketSize) => bucketSize > approx) - 1];
  }

  console.log({
    yBinIncr,
    xBinIncr,
  });

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
    let xi = (binX(xs[i]) - minXBin) / xBinIncr;
    let yi = (binY(ys[i]) - minYBin) / yBinIncr;
    let ci = xi * yBinQty + yi;

    counts[ci]++;
  }

  return {
    x: xs2,
    y: ys2,
    count: counts,
  };
}

function initBins(xQty: number, yQty: number, xMin: number, xIncr: number, yMin: number, yIncr: number) {
  let len = xQty * yQty;
  let xs = Array(len);
  let ys = Array(len);
  let counts = Array(len);

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
