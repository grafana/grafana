import _ from 'lodash';

export function getSeriesValues(data: any): number[] {
  let values = [];

  // Count histogam stats
  for (let i = 0; i < data.length; i++) {
    let series = data[i];
    for (let j = 0; j < series.data.length; j++) {
      if (series.data[j][1] !== null) {
        values.push(series.data[j][1]);
      }
    }
  }

  return values;
}

export function convertValuesToHistogram(values: number[], bucketSize: number): any[] {
  let histogram = {};

  for (let i = 0; i < values.length; i++) {
    let bound = getBucketBound(values[i], bucketSize);
    if (histogram[bound]) {
      histogram[bound] = histogram[bound] + 1;
    } else {
      histogram[bound] = 1;
    }
  }

  return _.map(histogram, (count, bound) => {
    return [Number(bound), count];
  });
}

function getBucketBound(value: number, bucketSize: number): number {
  return Math.floor(value / bucketSize) * bucketSize;
}

// Calculate tick step.
// Implementation from d3-array (ticks.js)
// https://github.com/d3/d3-array/blob/master/src/ticks.js
export function tickStep(start, stop, count) {
  var e10 = Math.sqrt(50),
    e5 = Math.sqrt(10),
    e2 = Math.sqrt(2);

  var step0 = Math.abs(stop - start) / Math.max(0, count),
    step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)),
    error = step0 / step1;

  if (error >= e10) {
    step1 *= 10;
  } else if (error >= e5) {
    step1 *= 5;
  } else if (error >= e2) {
    step1 *= 2;
  }

  return stop < start ? -step1 : step1;
}
