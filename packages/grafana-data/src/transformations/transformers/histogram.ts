import { map } from 'rxjs/operators';

import { outerJoinDataFrames } from '../..';
import { getDisplayProcessor } from '../../field/displayProcessor';
import { createTheme } from '../../themes/createTheme';
import { GrafanaTheme2 } from '../../themes/types';
import { DataFrame, Field, FieldConfig, FieldType } from '../../types/dataFrame';
import { DataFrameType } from '../../types/dataFrameTypes';
import { DataTransformContext, SynchronousDataTransformerInfo } from '../../types/transformations';
import { roundDecimals } from '../../utils/numbers';

import { DataTransformerID } from './ids';
import { AlignedData, join } from './joinDataFrames';
import { nullToValueField } from './nulls/nullToValue';

/**
 * @internal
 */
// prettier-ignore
export const histogramBucketSizes = [
  1e-9,  2e-9,  2.5e-9,  4e-9,  5e-9,
  1e-8,  2e-8,  2.5e-8,  4e-8,  5e-8,
  1e-7,  2e-7,  2.5e-7,  4e-7,  5e-7,
  1e-6,  2e-6,  2.5e-6,  4e-6,  5e-6,
  1e-5,  2e-5,  2.5e-5,  4e-5,  5e-5,
  1e-4,  2e-4,  2.5e-4,  4e-4,  5e-4,
  1e-3,  2e-3,  2.5e-3,  4e-3,  5e-3,
  1e-2,  2e-2,  2.5e-2,  4e-2,  5e-2,
  1e-1,  2e-1,  2.5e-1,  4e-1,  5e-1,
  1,     2,              4,     5,
  1e+1,  2e+1,  2.5e+1,  4e+1,  5e+1,
  1e+2,  2e+2,  2.5e+2,  4e+2,  5e+2,
  1e+3,  2e+3,  2.5e+3,  4e+3,  5e+3,
  1e+4,  2e+4,  2.5e+4,  4e+4,  5e+4,
  1e+5,  2e+5,  2.5e+5,  4e+5,  5e+5,
  1e+6,  2e+6,  2.5e+6,  4e+6,  5e+6,
  1e+7,  2e+7,  2.5e+7,  4e+7,  5e+7,
  1e+8,  2e+8,  2.5e+8,  4e+8,  5e+8,
  1e+9,  2e+9,  2.5e+9,  4e+9,  5e+9,
];

const DEFAULT_BUCKET_COUNT = 30;

const histFilter: number[] = [];
const histSort = (a: number, b: number) => a - b;

export interface HistogramTransformerInputs {
  bucketCount?: number;
  bucketSize?: string | number;
  bucketOffset?: string | number;
  combine?: boolean;
}

/**
 * @alpha
 */
export interface HistogramTransformerOptions {
  bucketCount?: number;
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
  bucketCount: {
    name: 'Bucket count',
    description: 'approx bucket count',
  },
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
export const histogramTransformer: SynchronousDataTransformerInfo<HistogramTransformerInputs> = {
  id: DataTransformerID.histogram,
  name: 'Histogram',
  description: 'Calculate a histogram from input data.',
  defaultOptions: {
    fields: {},
  },

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => histogramTransformer.transformer(options, ctx)(data))),

  transformer: (options: HistogramTransformerInputs, ctx: DataTransformContext) => (data: DataFrame[]) => {
    if (!Array.isArray(data) || data.length === 0) {
      return data;
    }

    let bucketSize,
      bucketOffset: number | undefined = undefined;

    if (options.bucketSize) {
      if (typeof options.bucketSize === 'string') {
        bucketSize = parseFloat(options.bucketSize);
      } else {
        bucketSize = options.bucketSize;
      }

      if (isNaN(bucketSize)) {
        bucketSize = undefined;
      }
    }

    if (options.bucketOffset) {
      if (typeof options.bucketOffset === 'string') {
        bucketOffset = parseFloat(options.bucketOffset);
      } else {
        bucketOffset = options.bucketOffset;
      }

      if (isNaN(bucketOffset)) {
        bucketOffset = undefined;
      }
    }

    const interpolatedOptions: HistogramTransformerOptions = {
      bucketSize: bucketSize,
      bucketOffset: bucketOffset,
      combine: options.combine,
    };

    const hist = buildHistogram(data, interpolatedOptions);
    if (hist == null) {
      return [];
    }
    return [histogramFieldsToFrame(hist)];
  },
};

/**
 * @internal
 */
export const histogramFrameBucketMinFieldName = 'xMin';

/**
 * @internal
 */
export function isHistogramFrameBucketMinFieldName(v: string) {
  return v === histogramFrameBucketMinFieldName || v === 'BucketMin'; // REMOVE 'BuckentMin/Max'
}

/**
 * @internal
 */
export const histogramFrameBucketMaxFieldName = 'xMax';

/**
 * @internal
 */
export function isHistogramFrameBucketMaxFieldName(v: string) {
  return v === histogramFrameBucketMaxFieldName || v === 'BucketMax'; // REMOVE 'BuckentMin/Max'
}

/**
 * @alpha
 */
export interface HistogramFields {
  xMin: Field;
  xMax: Field;
  counts: Field[]; // frequency
}

/**
 * Given a frame, find the explicit histogram fields
 *
 * @alpha
 */
export function getHistogramFields(frame: DataFrame): HistogramFields | undefined {
  // we ignore xMax (time field) and sum all counts together for each found bucket
  if (frame.meta?.type === DataFrameType.HeatmapCells) {
    // we assume uniform bucket size for now
    // we assume xMax, yMin, yMax fields
    let yMinField = frame.fields.find((f) => f.name === 'yMin')!;
    let yMaxField = frame.fields.find((f) => f.name === 'yMax')!;
    let countField = frame.fields.find((f) => f.name === 'count')!;

    let uniqueMaxs = [...new Set(yMaxField.values)].sort((a, b) => a - b);
    let uniqueMins = [...new Set(yMinField.values)].sort((a, b) => a - b);
    let countsByMax = new Map<number, number>();
    uniqueMaxs.forEach((max) => countsByMax.set(max, 0));

    for (let i = 0; i < yMaxField.values.length; i++) {
      let max = yMaxField.values[i];
      countsByMax.set(max, countsByMax.get(max) + countField.values[i]);
    }

    let fields = {
      xMin: {
        ...yMinField,
        name: 'xMin',
        values: uniqueMins,
      },
      xMax: {
        ...yMaxField,
        name: 'xMax',
        values: uniqueMaxs,
      },
      counts: [
        {
          ...countField,
          values: [...countsByMax.values()],
        },
      ],
    };

    return fields;
  } else if (frame.meta?.type === DataFrameType.HeatmapRows) {
    // assumes le

    // tick label strings (will be ordinal-ized)
    let minVals: string[] = [];
    let maxVals: string[] = [];

    // sums of all timstamps per bucket
    let countVals: number[] = [];

    let minVal = '0';
    frame.fields.forEach((f) => {
      if (f.type === FieldType.number) {
        let countsSum = f.values.reduce((acc, v) => acc + v, 0);
        countVals.push(countsSum);
        minVals.push(minVal);
        maxVals.push((minVal = f.name));
      }
    });

    // fake extra value for +Inf (for x scale ranging since bars are right-aligned)
    countVals.push(0);
    minVals.push(minVal);
    maxVals.push(minVal);

    let fields = {
      xMin: {
        ...frame.fields[1],
        name: 'xMin',
        type: FieldType.string,
        values: minVals,
      },
      xMax: {
        ...frame.fields[1],
        name: 'xMax',
        type: FieldType.string,
        values: maxVals,
      },
      counts: [
        {
          ...frame.fields[1],
          name: 'count',
          type: FieldType.number,
          values: countVals,
        },
      ],
    };

    return fields;
  }

  let xMin: Field | undefined = undefined;
  let xMax: Field | undefined = undefined;
  const counts: Field[] = [];
  for (const field of frame.fields) {
    if (isHistogramFrameBucketMinFieldName(field.name)) {
      xMin = field;
    } else if (isHistogramFrameBucketMaxFieldName(field.name)) {
      xMax = field;
    } else if (field.type === FieldType.number) {
      counts.push(field);
    }
  }

  // guess bucket size from single explicit bucket field
  if (!xMax && xMin && xMin.values.length > 1) {
    let vals = xMin.values;
    let bucketSize = roundDecimals(vals[1] - vals[0], 6);

    xMax = {
      ...xMin,
      name: histogramFrameBucketMaxFieldName,
      values: vals.map((v) => v + bucketSize),
    };
  }

  if (!xMin && xMax && xMax?.values.length > 1) {
    let vals = xMax.values;
    let bucketSize = roundDecimals(vals[1] - vals[0], 6);

    xMin = {
      ...xMax,
      name: histogramFrameBucketMinFieldName,
      values: vals.map((v) => v - bucketSize),
    };
  }

  if (xMin && xMax && counts.length) {
    return {
      xMin,
      xMax,
      counts,
    };
  }
  return undefined;
}

/**
 * @alpha
 */
export function buildHistogram(
  frames: DataFrame[],
  options?: HistogramTransformerOptions,
  theme?: GrafanaTheme2
): HistogramFields | null {
  let bucketSize = options?.bucketSize;
  let bucketCount = options?.bucketCount ?? DEFAULT_BUCKET_COUNT;
  let bucketOffset = options?.bucketOffset ?? 0;

  // replace or filter nulls from numeric fields
  frames = frames.map((frame) => {
    return {
      ...frame,
      fields: frame.fields.map((field) => {
        if (field.type === FieldType.number) {
          const noValue = Number(field.config.noValue);

          if (!Number.isNaN(noValue)) {
            field = nullToValueField(field, noValue);
          } else {
            field = { ...field, values: field.values.filter((v) => v != null) };
          }
        }

        return field;
      }),
    };
  });

  // if bucket size is auto, try to calc from all numeric fields
  if (!bucketSize || bucketSize < 0) {
    let allValues: number[] = [];

    // TODO: include field configs!
    for (const frame of frames) {
      for (const field of frame.fields) {
        if (field.type === FieldType.number) {
          allValues = allValues.concat(field.values);
        }
      }
    }

    allValues.sort((a, b) => a - b);

    let smallestDelta = Infinity;

    // TODO: case of 1 value needs work
    if (allValues.length === 1) {
      smallestDelta = 1;
    } else {
      for (let i = 1; i < allValues.length; i++) {
        let delta = allValues[i] - allValues[i - 1];

        if (delta !== 0) {
          smallestDelta = Math.min(smallestDelta, delta);
        }
      }
    }

    let min = allValues[0];
    let max = allValues[allValues.length - 1];

    let range = max - min;

    const targetSize = range / bucketCount;

    // choose bucket
    for (let i = 0; i < histogramBucketSizes.length; i++) {
      let _bucketSize = histogramBucketSizes[i];

      if (targetSize < _bucketSize && _bucketSize >= smallestDelta) {
        bucketSize = _bucketSize;
        break;
      }
    }
  }

  const getBucket = (v: number) => roundDecimals(incrRoundDn(v - bucketOffset, bucketSize!) + bucketOffset, 9);

  // guess number of decimals
  let bucketDecimals = (('' + bucketSize).match(/\.\d+$/) ?? ['.'])[0].length - 1;

  let histograms: AlignedData[] = [];
  let counts: Field[] = [];
  let config: FieldConfig | undefined = undefined;

  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        let fieldHist = histogram(field.values, getBucket, histFilter, histSort);
        histograms.push(fieldHist);

        const count = {
          ...field,
          config: {
            ...field.config,
            unit: field.config.unit === 'short' ? 'short' : undefined,
          },
        };

        count.display = getDisplayProcessor({
          field: count,
          theme: theme ?? createTheme(),
        });
        counts.push(count);
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

  const xMin: Field = {
    name: histogramFrameBucketMinFieldName,
    values: joinedHists[0],
    type: FieldType.number,
    state: undefined,
    config:
      bucketDecimals === 0
        ? (config ?? {})
        : {
            ...config,
            decimals: bucketDecimals,
          },
  };
  const xMax = {
    ...xMin,
    name: histogramFrameBucketMaxFieldName,
    values: joinedHists[0].map((v) => v + bucketSize!),
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
        name: 'count',
        values: vals,
        type: FieldType.number,
        state: {
          ...counts[0].state,
          displayName: 'Count',
          multipleFrames: false,
          origin: { frameIndex: 0, fieldIndex: 2 },
        },
      },
    ];
  } else {
    counts.forEach((field, i) => {
      field.values = joinedHists[i + 1];
    });
  }

  return {
    xMin,
    xMax,
    counts,
  };
}

/**
 * @internal
 */
export function incrRound(num: number, incr: number) {
  return Math.round(num / incr) * incr;
}

/**
 * @internal
 */
export function incrRoundUp(num: number, incr: number) {
  return Math.ceil(num / incr) * incr;
}

/**
 * @internal
 */
export function incrRoundDn(num: number, incr: number) {
  return Math.floor(num / incr) * incr;
}

function histogram(
  vals: number[],
  getBucket: (v: number) => number,
  filterOut?: number[],
  sort?: ((a: number, b: number) => number) | null
): AlignedData {
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
  if (!info.xMin.display) {
    const display = getDisplayProcessor({
      field: info.xMin,
      theme: theme ?? createTheme(),
    });
    info.xMin.display = display;
    info.xMax.display = display;
  }

  return {
    length: info.xMin.values.length,
    meta: {
      type: DataFrameType.Histogram,
    },
    fields: [info.xMin, info.xMax, ...info.counts],
    refId: `${DataTransformerID.histogram}`,
  };
}

/**
 *
 * Join multiple histograms into a histogram with multiple counts.
 * Useful eg if you want to overlay them for comparison.
 *
 * This is needed because histogram results from database
 * will have buckets omitted for 0 counts, but when joining multiple histograms
 * we need to fill in the 0 values for missing buckets.
 *
 * Returns field configs of the first provided histogram.
 * @alpha
 */

export function joinHistograms(histograms: HistogramFields[]): HistogramFields {
  if (histograms.length === 1) {
    return histograms[0];
  }

  let joined = outerJoinDataFrames({
    frames: histograms.map((h) => ({
      length: h.xMax.values.length,
      fields: [h.xMax, h.xMin, ...h.counts],
    })),
    joinBy: (field) => field.name === 'xMax',
  })!;

  let xMaxField: Field | null = null;
  let xMinField: Field | null = null;
  let countFields: Field[] = [];

  // merge all xMin fields into first xMin field
  // and default all count fields to 0
  joined.fields.forEach((f) => {
    if (f.name === 'xMax') {
      xMaxField = f;
    } else if (f.name === 'xMin') {
      if (xMinField == null) {
        xMinField = f;
      } else {
        for (let i = 0; i < f.values.length; i++) {
          xMinField.values[i] ??= f.values[i];
        }
      }
    } else {
      countFields.push({
        ...f,
        values: f.values.map((v) => v ?? 0),
      });
    }
  });

  const result: HistogramFields = {
    xMin: xMinField!,
    xMax: xMaxField!,
    counts: countFields,
  };

  return result;
}
