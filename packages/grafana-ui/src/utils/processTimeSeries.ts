// Libraries
import _ from 'lodash';

import { colors } from './colors';

// Types
import { TimeSeries, TimeSeriesVMs, NullValueMode, TimeSeriesValue } from '../types';

interface Options {
  timeSeries: TimeSeries[];
  nullValueMode: NullValueMode;
}

export function processTimeSeries({ timeSeries, nullValueMode }: Options): TimeSeriesVMs {
  const vmSeries = timeSeries.map((item, index) => {
    const colorIndex = index % colors.length;
    const label = item.target;
    const result = [];

    // stat defaults
    let total = 0;
    let max: TimeSeriesValue = -Number.MAX_VALUE;
    let min: TimeSeriesValue = Number.MAX_VALUE;
    let logmin = Number.MAX_VALUE;
    let avg: TimeSeriesValue = null;
    let current: TimeSeriesValue = null;
    let first: TimeSeriesValue = null;
    let delta: TimeSeriesValue = 0;
    let diff: TimeSeriesValue = null;
    let range: TimeSeriesValue = null;
    let timeStep = Number.MAX_VALUE;
    let allIsNull = true;
    let allIsZero = true;

    const ignoreNulls = nullValueMode === NullValueMode.Ignore;
    const nullAsZero = nullValueMode === NullValueMode.AsZero;

    let currentTime: TimeSeriesValue = null;
    let currentValue: TimeSeriesValue = null;
    let nonNulls = 0;
    let previousTime: TimeSeriesValue = null;
    let previousValue = 0;
    let previousDeltaUp = true;

    for (let i = 0; i < item.datapoints.length; i++) {
      currentValue = item.datapoints[i][0];
      currentTime = item.datapoints[i][1];

      if (typeof currentTime !== 'number') {
        continue;
      }

      if (currentValue !== null && typeof currentValue !== 'number') {
        throw {message: 'Time series contains non number values'};
      }

      // Due to missing values we could have different timeStep all along the series
      // so we have to find the minimum one (could occur with aggregators such as ZimSum)
      if (previousTime !== null && currentTime !== null) {
        const currentStep = currentTime - previousTime;
        if (currentStep < timeStep) {
          timeStep = currentStep;
        }
      }

      previousTime = currentTime;

      if (currentValue === null) {
        if (ignoreNulls) {
          continue;
        }
        if (nullAsZero) {
          currentValue = 0;
        }
      }

      if (currentValue !== null) {
        if (_.isNumber(currentValue)) {
          total += currentValue;
          allIsNull = false;
          nonNulls++;
        }

        if (currentValue > max) {
          max = currentValue;
        }

        if (currentValue < min) {
          min = currentValue;
        }

        if (first === null) {
          first = currentValue;
        } else {
          if (previousValue > currentValue) {
            // counter reset
            previousDeltaUp = false;
            if (i === item.datapoints.length - 1) {
              // reset on last
              delta += currentValue;
            }
          } else {
            if (previousDeltaUp) {
              delta += currentValue - previousValue; // normal increment
            } else {
              delta += currentValue; // account for counter reset
            }
            previousDeltaUp = true;
          }
        }
        previousValue = currentValue;

        if (currentValue < logmin && currentValue > 0) {
          logmin = currentValue;
        }

        if (currentValue !== 0) {
          allIsZero = false;
        }
      }

      result.push([currentTime, currentValue]);
    }

    if (max === -Number.MAX_VALUE) {
      max = null;
    }

    if (min === Number.MAX_VALUE) {
      min = null;
    }

    if (result.length && !allIsNull) {
      avg = total / nonNulls;
      current = result[result.length - 1][1];
      if (current === null && result.length > 1) {
        current = result[result.length - 2][1];
      }
    }

    if (max !== null && min !== null) {
      range = max - min;
    }

    if (current !== null && first !== null) {
      diff = current - first;
    }

    const count = result.length;

    return {
      data: result,
      label: label,
      color: colors[colorIndex],
      allIsZero,
      allIsNull,
      stats: {
        total,
        min,
        max,
        current,
        logmin,
        avg,
        diff,
        delta,
        timeStep,
        range,
        count,
        first,
      },
    };
  });

  return vmSeries;
}
