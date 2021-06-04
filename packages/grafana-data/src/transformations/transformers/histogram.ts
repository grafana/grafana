import { DataTransformerInfo } from '../../types';
import { map } from 'rxjs/operators';

import { DataTransformerID } from './ids';
import { DataFrame, Field, FieldConfig, FieldType } from '../../types/dataFrame';
import { ArrayVector } from '../../vector/ArrayVector';
import { AlignedData, join } from './joinDataFrames';
import { getDisplayProcessor } from '../../field';
import { createTheme, GrafanaTheme2 } from '../../themes';

/* eslint-disable */
// prettier-ignore
/**
 * @internal
 */
export const histogramBucketSizes = [
    .001, .002, .0025, .005,
     .01,  .02,  .025,  .05,
      .1,   .2,   .25,   .5,
       1,    2,     4,    5,
      10,   20,    25,   50,
     100,  200,   250,  500,
    1000, 2000,  2500, 5000,
];
/* eslint-enable */

const histFilter = [null];
const histSort = (a: number, b: number) => a - b;

/**
 * @alpha
 */
export interface HistogramTransformerOptions {
  bucketSize?: number; // 0 is auto
  bucketOffset?: number;
  // xMin?: number;
  // xMax?: number;
  combine?: boolean; // if multiple series are input, join them into one
}

/**
 * This is a helper class to use the same text in both a panel and transformer UI
 *
 * @internal
 */
export const histogramFieldInfo = {
  bucketSize: {
    name: 'Bucket size',
    description: undefined,
  },
  bucketOffset: {
    name: 'Bucket offset',
    description: 'for non-zero-based buckets',
  },
  combine: {
    name: 'Combine series',
    description: 'combine all series into a single histogram',
  },
};

/**
 * @alpha
 */
export const histogramTransformer: DataTransformerInfo<HistogramTransformerOptions> = {
  id: DataTransformerID.histogram,
  name: 'Histogram',
  description: 'Calculate a histogram from input data',
  defaultOptions: {
    fields: {},
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }
        const hist = buildHistogram(data, options);
        if (hist == null) {
          return [];
        }
        return [histogramFieldsToFrame(hist)];
      })
    ),
};

/**
 * @internal
 */
export const histogramFrameBucketMinFieldName = 'BucketMin';

/**
 * @internal
 */
export const histogramFrameBucketMaxFieldName = 'BucketMax';

/**
 * @alpha
 */
export interface HistogramFields {
  bucketMin: Field;
  bucketMax: Field;
  counts: Field[]; // frequency
}

/**
 * Given a frame, find the explicit histogram fields
 *
 * @alpha
 */
export function getHistogramFields(frame: DataFrame): HistogramFields | undefined {
  let bucketMin: Field | undefined = undefined;
  let bucketMax: Field | undefined = undefined;
  const counts: Field[] = [];
  for (const field of frame.fields) {
    if (field.name === histogramFrameBucketMinFieldName) {
      bucketMin = field;
    } else if (field.name === histogramFrameBucketMaxFieldName) {
      bucketMax = field;
    } else if (field.type === FieldType.number) {
      counts.push(field);
    }
  }
  if (bucketMin && bucketMax && counts.length) {
    return {
      bucketMin,
      bucketMax,
      counts,
    };
  }
  return undefined;
}

/**
 * @alpha
 */
export function buildHistogram(frames: DataFrame[], options?: HistogramTransformerOptions): HistogramFields | null {
  let bucketSize = options?.bucketSize;
  let bucketOffset = options?.bucketOffset ?? 0;

  // if bucket size is auto, try to calc from all numeric fields
  if (!bucketSize) {
    let min = Infinity,
      max = -Infinity;

    // TODO: include field configs!
    for (const frame of frames) {
      for (const field of frame.fields) {
        if (field.type === FieldType.number) {
          for (const value of field.values.toArray()) {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        }
      }
    }

    let range = Math.abs(max - min);

    // choose bucket
    for (const size of histogramBucketSizes) {
      if (range / 10 < size) {
        bucketSize = size;
        break;
      }
    }
  }

  const getBucket = (v: number) => incrRoundDn(v - bucketOffset, bucketSize!) + bucketOffset;

  let histograms: AlignedData[] = [];
  let counts: Field[] = [];
  let config: FieldConfig | undefined = undefined;

  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        let fieldHist = histogram(field.values.toArray(), getBucket, histFilter, histSort) as AlignedData;
        histograms.push(fieldHist);
        counts.push({
          ...field,
          config: {
            ...field.config,
            unit: undefined,
          },
        });
        if (!config && field.config.unit) {
          config = field.config;
        }
      }
    }
  }

  // Quit early for empty a
  if (!counts.length) {
    return null;
  }

  // align histograms
  let joinedHists = join(histograms);

  // zero-fill all undefined values (missing buckets -> 0 counts)
  for (let histIdx = 1; histIdx < joinedHists.length; histIdx++) {
    let hist = joinedHists[histIdx];

    for (let bucketIdx = 0; bucketIdx < hist.length; bucketIdx++) {
      if (hist[bucketIdx] == null) {
        hist[bucketIdx] = 0;
      }
    }
  }

  const bucketMin: Field = {
    name: histogramFrameBucketMinFieldName,
    values: new ArrayVector(joinedHists[0]),
    type: FieldType.number,
    state: undefined,
    config: config ?? {},
  };
  const bucketMax = {
    ...bucketMin,
    name: histogramFrameBucketMaxFieldName,
    values: new ArrayVector(joinedHists[0].map((v) => v + bucketSize!)),
  };

  if (options?.combine) {
    const vals = new Array(joinedHists[0].length).fill(0);
    for (let i = 1; i < joinedHists.length; i++) {
      for (let j = 0; j < vals.length; j++) {
        vals[j] += joinedHists[i][j];
      }
    }
    counts = [
      {
        ...counts[0],
        name: 'Count',
        values: new ArrayVector(vals),
        type: FieldType.number,
        state: undefined,
      },
    ];
  } else {
    counts.forEach((field, i) => {
      field.values = new ArrayVector(joinedHists[i + 1]);
    });
  }

  return {
    bucketMin,
    bucketMax,
    counts,
  };
}

// function incrRound(num: number, incr: number) {
//   return Math.round(num / incr) * incr;
// }

// function incrRoundUp(num: number, incr: number) {
//   return Math.ceil(num / incr) * incr;
// }

function incrRoundDn(num: number, incr: number) {
  return Math.floor(num / incr) * incr;
}

function histogram(
  vals: number[],
  getBucket: (v: number) => number,
  filterOut?: any[] | null,
  sort?: ((a: any, b: any) => number) | null
) {
  let hist = new Map();

  for (let i = 0; i < vals.length; i++) {
    let v = vals[i];

    if (v != null) {
      v = getBucket(v);
    }

    let entry = hist.get(v);

    if (entry) {
      entry.count++;
    } else {
      hist.set(v, { value: v, count: 1 });
    }
  }

  filterOut && filterOut.forEach((v) => hist.delete(v));

  let bins = [...hist.values()];

  sort && bins.sort((a, b) => sort(a.value, b.value));

  let values = Array(bins.length);
  let counts = Array(bins.length);

  for (let i = 0; i < bins.length; i++) {
    values[i] = bins[i].value;
    counts[i] = bins[i].count;
  }

  return [values, counts];
}

/**
 * @internal
 */
export function histogramFieldsToFrame(info: HistogramFields, theme?: GrafanaTheme2): DataFrame {
  if (!info.bucketMin.display) {
    const display = getDisplayProcessor({
      field: info.bucketMin,
      theme: theme ?? createTheme(),
    });
    info.bucketMin.display = display;
    info.bucketMax.display = display;
  }
  return {
    fields: [info.bucketMin, info.bucketMax, ...info.counts],
    length: info.bucketMin.values.length,
  };
}
