// Libraries
import isNumber from 'lodash/isNumber';

import { colors } from './colors';

// Types
import { TimeSeriesVMs, NullValueMode, TimeSeriesValue, TableData, TimeSeries } from '../types';

interface Options {
  data: TableData[];
  xColumn?: number; // Time (or null to guess)
  yColumn?: number; // Value (or null to guess)
  nullValueMode: NullValueMode;
}

export function processTimeSeries({ data, xColumn, yColumn, nullValueMode }: Options): TimeSeriesVMs {
  const vmSeries = data.map((item, index) => {
    if (!isNumber(xColumn)) {
      xColumn = 1; // Default timeseries colum.  TODO, find first time field!
    }
    if (!isNumber(yColumn)) {
      yColumn = 0; // TODO, find first non-time field
    }

    // TODO? either % or throw error?
    if (xColumn >= item.columns.length) {
      throw new Error('invalid colum: ' + xColumn);
    }
    if (yColumn >= item.columns.length) {
      throw new Error('invalid colum: ' + yColumn);
    }

    const colorIndex = index % colors.length;
    const label = item.columns[yColumn].text;
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

    for (let i = 0; i < item.rows.length; i++) {
      currentValue = item.rows[i][yColumn];
      currentTime = item.rows[i][xColumn];

      if (typeof currentTime !== 'number') {
        continue;
      }

      if (currentValue !== null && typeof currentValue !== 'number') {
        throw { message: 'Time series contains non number values' };
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
        if (isNumber(currentValue)) {
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
            if (i === item.rows.length - 1) {
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

export const isTableData = (data: any): data is TableData => data && data.hasOwnProperty('columns');

export const toTableData = (results?: any[]): TableData[] => {
  if (!results) {
    return [];
  }

  return results
    .filter(d => !!d)
    .map(data => {
      if (data.hasOwnProperty('columns')) {
        return data as TableData;
      }
      if (data.hasOwnProperty('datapoints')) {
        const ts = data as TimeSeries;
        return {
          columns: [
            {
              text: ts.target || 'Value',
              unit: ts.unit,
            },
            {
              text: 'Time',
              type: 'time',
            },
          ],
          rows: ts.datapoints,
        } as TableData;
      }
      // TODO, try to convert JSON to table?
      console.warn('Can not convert', data);
      throw new Error('Unsupported data format');
    });
};
