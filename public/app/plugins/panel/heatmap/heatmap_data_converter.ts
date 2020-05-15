import _ from 'lodash';
import { TimeSeries } from 'app/core/core';
import { Bucket, HeatmapCard, HeatmapCardStats, YBucket, XBucket } from './types';

const VALUE_INDEX = 0;
const TIME_INDEX = 1;

/**
 * Convert histogram represented by the list of series to heatmap object.
 * @param seriesList List of time series
 */
function histogramToHeatmap(seriesList: TimeSeries[]) {
  const heatmap: any = {};

  for (let i = 0; i < seriesList.length; i++) {
    const series = seriesList[i];
    const bound = i;
    if (isNaN(bound)) {
      return heatmap;
    }

    for (const point of series.datapoints) {
      const count = point[VALUE_INDEX];
      const time = point[TIME_INDEX];

      if (!_.isNumber(count)) {
        continue;
      }

      let bucket = heatmap[time];
      if (!bucket) {
        bucket = heatmap[time] = { x: time, buckets: {} };
      }

      bucket.buckets[bound] = {
        y: bound,
        count: count,
        bounds: {
          top: null,
          bottom: bound,
        },
        values: [],
        points: [],
      };
    }
  }

  return heatmap;
}

/**
 * Sort series representing histogram by label value.
 */
function sortSeriesByLabel(s1: { label: string }, s2: { label: string }) {
  let label1, label2;

  try {
    // fail if not integer. might happen with bad queries
    label1 = parseHistogramLabel(s1.label);
    label2 = parseHistogramLabel(s2.label);
  } catch (err) {
    console.log(err.message || err);
    return 0;
  }

  if (label1 > label2) {
    return 1;
  }

  if (label1 < label2) {
    return -1;
  }

  return 0;
}

function parseHistogramLabel(label: string): number {
  if (label === '+Inf' || label === 'inf') {
    return +Infinity;
  }
  const value = Number(label);
  if (isNaN(value)) {
    throw new Error(`Error parsing histogram label: ${label} is not a number`);
  }
  return value;
}

/**
 * Convert buckets into linear array of "cards" - objects, represented heatmap elements.
 * @param  {Object} buckets
 * @return {Object}          Array of "card" objects and stats
 */
function convertToCards(buckets: any, hideZero = false): { cards: HeatmapCard[]; cardStats: HeatmapCardStats } {
  let min = 0,
    max = 0;
  const cards: HeatmapCard[] = [];
  _.forEach(buckets, xBucket => {
    _.forEach(xBucket.buckets, yBucket => {
      const card: HeatmapCard = {
        x: xBucket.x,
        y: yBucket.y,
        yBounds: yBucket.bounds,
        values: yBucket.values,
        count: yBucket.count,
      };
      if (!hideZero || card.count !== 0) {
        cards.push(card);
      }

      if (cards.length === 1) {
        min = yBucket.count;
        max = yBucket.count;
      }

      min = yBucket.count < min ? yBucket.count : min;
      max = yBucket.count > max ? yBucket.count : max;
    });
  });

  const cardStats = { min, max };
  return { cards, cardStats };
}

/**
 * Special method for log scales. When series converted into buckets with log scale,
 * for simplification, 0 values are converted into 0, not into -Infinity. On the other hand, we mean
 * that all values less than series minimum, is 0 values, and we create special "minimum" bucket for
 * that values (actually, there're no values less than minimum, so this bucket is empty).
 *  8-16|    | ** |    |  * |  **|
 *   4-8|  * |*  *|*   |** *| *  |
 *   2-4| * *|    | ***|    |*   |
 *   1-2|*   |    |    |    |    | This bucket contains minimum series value
 * 0.5-1|____|____|____|____|____| This bucket should be displayed as 0 on graph
 *     0|____|____|____|____|____| This bucket is for 0 values (should actually be -Infinity)
 * So we should merge two bottom buckets into one (0-value bucket).
 *
 * @param  {Object} buckets  Heatmap buckets
 * @param  {Number} minValue Minimum series value
 * @return {Object}          Transformed buckets
 */
function mergeZeroBuckets(buckets: any, minValue: number) {
  _.forEach(buckets, xBucket => {
    const yBuckets = xBucket.buckets;

    const emptyBucket: any = {
      bounds: { bottom: 0, top: 0 },
      values: [],
      points: [],
      count: 0,
    };

    const nullBucket = yBuckets[0] || emptyBucket;
    const minBucket = yBuckets[minValue] || emptyBucket;

    const newBucket: any = {
      y: 0,
      bounds: { bottom: minValue, top: minBucket.bounds.top || minValue },
      values: [],
      points: [],
      count: 0,
    };

    newBucket.points = nullBucket.points.concat(minBucket.points);
    newBucket.values = nullBucket.values.concat(minBucket.values);
    newBucket.count = newBucket.values.length;

    if (newBucket.count === 0) {
      return;
    }

    delete yBuckets[minValue];
    yBuckets[0] = newBucket;
  });

  return buckets;
}

/**
 * Convert set of time series into heatmap buckets
 * @return {Object}    Heatmap object:
 * {
 *   xBucketBound_1: {
 *     x: xBucketBound_1,
 *     buckets: {
 *       yBucketBound_1: {
 *         y: yBucketBound_1,
 *         bounds: {bottom, top}
 *         values: [val_1, val_2, ..., val_K],
 *         points: [[val_Y, val_X, series_name], ..., [...]],
 *         seriesStat: {seriesName_1: val_1, seriesName_2: val_2}
 *       },
 *       ...
 *       yBucketBound_M: {}
 *     },
 *     values: [val_1, val_2, ..., val_K],
 *     points: [
 *       [val_Y, val_X, series_name], (point_1)
 *       ...
 *       [...] (point_K)
 *     ]
 *   },
 *   xBucketBound_2: {},
 *   ...
 *   xBucketBound_N: {}
 * }
 */
function convertToHeatMap(seriesList: TimeSeries[], yBucketSize: number, xBucketSize: number, logBase = 1) {
  const heatmap = {};

  for (const series of seriesList) {
    const datapoints = series.datapoints;
    const seriesName = series.label;

    // Slice series into X axis buckets
    // |    | ** |    |  * |  **|
    // |  * |*  *|*   |** *| *  |
    // |** *|    | ***|    |*   |
    // |____|____|____|____|____|_
    //
    _.forEach(datapoints, point => {
      const bucketBound = getBucketBound(point[TIME_INDEX], xBucketSize);
      pushToXBuckets(heatmap, point, bucketBound, seriesName);
    });
  }

  // Slice X axis buckets into Y (value) buckets
  // |  **|     |2|,
  // | *  | --\ |1|,
  // |*   | --/ |1|,
  // |____|     |0|
  //
  _.forEach(heatmap, (xBucket: any) => {
    if (logBase !== 1) {
      xBucket.buckets = convertToLogScaleValueBuckets(xBucket, yBucketSize, logBase);
    } else {
      xBucket.buckets = convertToValueBuckets(xBucket, yBucketSize);
    }
  });

  return heatmap;
}

function pushToXBuckets(buckets: any, point: any[], bucketNum: number, seriesName: string) {
  const value = point[VALUE_INDEX];
  if (value === null || value === undefined || isNaN(value)) {
    return;
  }

  // Add series name to point for future identification
  const pointExt = _.concat(point, seriesName);

  if (buckets[bucketNum] && buckets[bucketNum].values) {
    buckets[bucketNum].values.push(value);
    buckets[bucketNum].points.push(pointExt);
  } else {
    buckets[bucketNum] = {
      x: bucketNum,
      values: [value],
      points: [pointExt],
    };
  }
}

function pushToYBuckets(
  buckets: Bucket,
  bucketNum: number,
  value: any,
  point: string[],
  bounds: { bottom: number; top: number }
) {
  let count = 1;
  // Use the 3rd argument as scale/count
  if (point.length > 3) {
    count = parseInt(point[2], 10);
  }
  if (buckets[bucketNum]) {
    buckets[bucketNum].values.push(value);
    buckets[bucketNum].points?.push(point);
    buckets[bucketNum].count += count;
  } else {
    buckets[bucketNum] = {
      y: bucketNum,
      bounds: bounds,
      values: [value],
      points: [point],
      count: count,
    };
  }
}

function getValueBucketBound(value: any, yBucketSize: number, logBase: number) {
  if (logBase === 1) {
    return getBucketBound(value, yBucketSize);
  } else {
    return getLogScaleBucketBound(value, yBucketSize, logBase);
  }
}

/**
 * Find bucket for given value (for linear scale)
 */
function getBucketBounds(value: number, bucketSize: number) {
  let bottom, top;
  bottom = Math.floor(value / bucketSize) * bucketSize;
  top = (Math.floor(value / bucketSize) + 1) * bucketSize;

  return { bottom, top };
}

function getBucketBound(value: number, bucketSize: number) {
  const bounds = getBucketBounds(value, bucketSize);
  return bounds.bottom;
}

function convertToValueBuckets(xBucket: { values: any; points: any }, bucketSize: number) {
  const values = xBucket.values;
  const points = xBucket.points;
  const buckets = {};

  _.forEach(values, (val, index) => {
    const bounds = getBucketBounds(val, bucketSize);
    const bucketNum = bounds.bottom;
    pushToYBuckets(buckets, bucketNum, val, points[index], bounds);
  });

  return buckets;
}

/**
 * Find bucket for given value (for log scales)
 */
function getLogScaleBucketBounds(value: number, yBucketSplitFactor: number, logBase: number) {
  let top, bottom;
  if (value === 0) {
    return { bottom: 0, top: 0 };
  }

  const valueLog = logp(value, logBase);
  let pow, powTop;
  if (yBucketSplitFactor === 1 || !yBucketSplitFactor) {
    pow = Math.floor(valueLog);
    powTop = pow + 1;
  } else {
    const additionalBucketSize = 1 / yBucketSplitFactor;
    let additionalLog = valueLog - Math.floor(valueLog);
    additionalLog = Math.floor(additionalLog / additionalBucketSize) * additionalBucketSize;
    pow = Math.floor(valueLog) + additionalLog;
    powTop = pow + additionalBucketSize;
  }
  bottom = Math.pow(logBase, pow);
  top = Math.pow(logBase, powTop);

  return { bottom, top };
}

function getLogScaleBucketBound(value: number, yBucketSplitFactor: number, logBase: number) {
  const bounds = getLogScaleBucketBounds(value, yBucketSplitFactor, logBase);
  return bounds.bottom;
}

function convertToLogScaleValueBuckets(
  xBucket: { values: any; points: any },
  yBucketSplitFactor: number,
  logBase: number
) {
  const values = xBucket.values;
  const points = xBucket.points;

  const buckets = {};
  _.forEach(values, (val, index) => {
    const bounds = getLogScaleBucketBounds(val, yBucketSplitFactor, logBase);
    const bucketNum = bounds.bottom;
    pushToYBuckets(buckets, bucketNum, val, points[index], bounds);
  });

  return buckets;
}

/**
 * Logarithm for custom base
 * @param value
 * @param base logarithm base
 */
function logp(value: number, base: number) {
  return Math.log(value) / Math.log(base);
}

/**
 * Calculate size of Y bucket from given buckets bounds.
 * @param bounds Array of Y buckets bounds
 * @param logBase Logarithm base
 */
function calculateBucketSize(bounds: number[], logBase = 1): number {
  let bucketSize = Infinity;

  if (bounds.length === 0) {
    return 0;
  } else if (bounds.length === 1) {
    return bounds[0];
  } else {
    bounds = _.sortBy(bounds);
    for (let i = 1; i < bounds.length; i++) {
      const distance = getDistance(bounds[i], bounds[i - 1], logBase);
      bucketSize = distance < bucketSize ? distance : bucketSize;
    }
  }

  return bucketSize;
}

/**
 * Calculate distance between two numbers in given scale (linear or logarithmic).
 * @param a
 * @param b
 * @param logBase
 */
function getDistance(a: number, b: number, logBase = 1): number {
  if (logBase === 1) {
    // Linear distance
    return Math.abs(b - a);
  } else {
    // logarithmic distance
    const ratio = Math.max(a, b) / Math.min(a, b);
    return logp(ratio, logBase);
  }
}

/**
 * Compare two heatmap data objects
 * @param objA
 * @param objB
 */
function isHeatmapDataEqual(objA: any, objB: any): boolean {
  let isEql = !emptyXOR(objA, objB);

  _.forEach(objA, (xBucket: XBucket, x) => {
    if (objB[x]) {
      if (emptyXOR(xBucket.buckets, objB[x].buckets)) {
        isEql = false;
        return false;
      }

      _.forEach(xBucket.buckets, (yBucket: YBucket, y) => {
        if (objB[x].buckets && objB[x].buckets[y]) {
          if (objB[x].buckets[y].values) {
            isEql = _.isEqual(_.sortBy(yBucket.values), _.sortBy(objB[x].buckets[y].values));
            if (!isEql) {
              return false;
            } else {
              return true;
            }
          } else {
            isEql = false;
            return false;
          }
        } else {
          isEql = false;
          return false;
        }
      });

      if (!isEql) {
        return false;
      } else {
        return true;
      }
    } else {
      isEql = false;
      return false;
    }
  });

  return isEql;
}

function emptyXOR(foo: any, bar: any): boolean {
  return (_.isEmpty(foo) || _.isEmpty(bar)) && !(_.isEmpty(foo) && _.isEmpty(bar));
}

export {
  convertToHeatMap,
  histogramToHeatmap,
  convertToCards,
  mergeZeroBuckets,
  getValueBucketBound,
  isHeatmapDataEqual,
  calculateBucketSize,
  sortSeriesByLabel,
};
