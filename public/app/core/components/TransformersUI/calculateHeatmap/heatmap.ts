import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  FieldType,
  histogramBucketSizes as linearBucketSizes,
  incrRoundUp,
  incrRoundDn,
  SynchronousDataTransformerInfo,
} from '@grafana/data';
import { map } from 'rxjs';
import { HeatmapCalculationOptions } from './models.gen';

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
    xUnit: BucketSizeUnit.Value,
    xSize: +(options.xAxis?.value ?? 60e3),
    yUnit: BucketSizeUnit.Value,
    ySize: +(options.yAxis?.value ?? 10),
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

const enum BucketSizeUnit {
  Value = 1,
  Percent = 2,
}

interface HeatmapOpts {
  // default is 10% of data range, snapped to a "nice" increment
  xUnit?: BucketSizeUnit;
  yUnit?: BucketSizeUnit;
  xSize?: number;
  ySize?: number;

  // use Math.ceil instead of Math.floor for bucketing
  xCeil?: boolean;
  yCeil?: boolean;

  // log2 or log10 buckets
  xLog?: 2 | 10;
  yLog?: 2 | 10;

  // optimization hints for known data ranges (sorted, pre-scanned, etc)
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
}

function heatmap(xs: number[], ys: number[], opts?: HeatmapOpts) {
  let len = xs.length;

  // find x and y limits to pre-compute buckets struct
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < len; i++) {
    if (xs[i] != null) {
      minX = Math.min(minX, xs[i]);
      maxX = Math.max(maxX, xs[i]);
    }

    if (ys[i] != null) {
      minY = Math.min(minY, ys[i]);
      maxY = Math.max(maxY, ys[i]);
    }
  }

  //let scaleX = opts?.xLog === 10 ? Math.log10 : opts?.xLog === 2 ? Math.log2 : (v: number) => v;
  //let scaleY = opts?.yLog === 10 ? Math.log10 : opts?.yLog === 2 ? Math.log2 : (v: number) => v;

  // todo: optionally use view range instead of data range for bucket sizing
  let xUnit = opts?.xUnit ?? BucketSizeUnit.Percent;
  let yUnit = opts?.yUnit ?? BucketSizeUnit.Percent;
  let xBinIncr = opts?.xSize ?? 0.1; // linear default
  let yBinIncr = opts?.ySize ?? 0.1; // linear default

  if (xUnit === BucketSizeUnit.Percent) {
    let approx = (maxX - minX) * xBinIncr;
    // nice-ify
    xBinIncr = linearBucketSizes[linearBucketSizes.findIndex((bucketSize) => bucketSize > approx) - 1];
  }

  if (yUnit === BucketSizeUnit.Percent) {
    let approx = (maxY - minY) * yBinIncr;
    // nice-ify
    yBinIncr = linearBucketSizes[linearBucketSizes.findIndex((bucketSize) => bucketSize > approx) - 1];
  }

  let binX = opts?.xCeil ? (v: number) => incrRoundUp(v, xBinIncr) : (v: number) => incrRoundDn(v, xBinIncr);
  let binY = opts?.yCeil ? (v: number) => incrRoundUp(v, yBinIncr) : (v: number) => incrRoundDn(v, yBinIncr);

  let minXBin = binX(minX);
  let maxXBin = binX(maxX);
  let minYBin = binY(minY);
  let maxYBin = binY(maxY);

  let xBinQty = (maxXBin - minXBin) / xBinIncr + 1;
  let yBinQty = (maxYBin - minYBin) / yBinIncr + 1;

  let [xs2, ys2, counts] = initBins(xBinQty, yBinQty, minXBin, xBinIncr, minYBin, yBinIncr);

  for (let i = 0; i < len; i++) {
    if (xs[i] != null && ys[i] != null) {
      let xi = (binX(xs[i]) - minXBin) / xBinIncr;
      let yi = (binY(ys[i]) - minYBin) / yBinIncr;
      let ci = xi * yBinQty + yi;

      counts[ci]++;
    }
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
  let counts = Array(len).fill(0);

  for (let i = 0, xi = 0; xi < len; xi += yQty, i++) {
    xs.fill(xMin + i * xIncr, xi, xi + yQty);
  }
  for (let i = 0; i < len; i++) {
    ys[i] = yMin + (i % yQty) * yIncr;
  }

  return [xs, ys, counts];
}
