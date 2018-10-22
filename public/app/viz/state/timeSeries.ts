// Libraries
import _ from 'lodash';

// Utils
import colors from 'app/core/utils/colors';

// Types
import { TimeSeries, TimeSeriesVMs, NullValueMode } from 'app/types';

interface Options {
  timeSeries: TimeSeries[];
  nullValueMode: NullValueMode;
}

export function getTimeSeriesVMs({ timeSeries, nullValueMode }: Options): TimeSeriesVMs {
  const vmSeries = timeSeries.map((item, index) => {
    const colorIndex = index % colors.length;
    const label = item.target;
    const result = [];

    // stat defaults
    let total = 0;
    let max = -Number.MAX_VALUE;
    let min = Number.MAX_VALUE;
    let logmin = Number.MAX_VALUE;
    let avg = null;
    let current = null;
    let first = null;
    let delta = 0;
    let diff = null;
    let range = null;
    let timeStep = Number.MAX_VALUE;
    let allIsNull = true;
    let allIsZero = true;

    const ignoreNulls = nullValueMode === NullValueMode.Ignore;
    const nullAsZero = nullValueMode === NullValueMode.AsZero;

    let currentTime;
    let currentValue;
    let nonNulls = 0;
    let previousTime;
    let previousValue = 0;
    let previousDeltaUp = true;

    for (let i = 0; i < item.datapoints.length; i++) {
      currentValue = item.datapoints[i][0];
      currentTime = item.datapoints[i][1];

      // Due to missing values we could have different timeStep all along the series
      // so we have to find the minimum one (could occur with aggregators such as ZimSum)
      if (previousTime !== undefined) {
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
        allIsZero,
        allIsNull,
      },
    };
  });

  return vmSeries;
}
