import { Field } from '../types/dataFrame';
import { NullValueMode } from '../types/data';
import { GraphSeriesValue } from '../types/graph';
import { TimeRange } from '../types/time';

// Types
// import { NullValueMode, GraphSeriesValue, Field, TimeRange } from '@grafana/data';
export interface FlotPairsOptions {
  xField: Field;
  yField: Field;
  nullValueMode?: NullValueMode;
}

export function getFlotPairs({ xField, yField, nullValueMode }: FlotPairsOptions): GraphSeriesValue[][] {
  const vX = xField.values;
  const vY = yField.values;
  const length = vX.length;
  if (vY.length !== length) {
    throw new Error('Unexpected field length');
  }

  const ignoreNulls = nullValueMode === NullValueMode.Ignore;
  const nullAsZero = nullValueMode === NullValueMode.AsZero;

  const pairs: any[][] = [];

  for (let i = 0; i < length; i++) {
    const x = vX.get(i);
    let y = vY.get(i);

    if (y === null) {
      if (ignoreNulls) {
        continue;
      }
      if (nullAsZero) {
        y = 0;
      }
    }

    // X must be a value
    if (x === null) {
      continue;
    }

    pairs.push([x, y]);
  }
  return pairs;
}

/**
 * Returns a constant series based on the first value from the provide series.
 * @param seriesData Series
 * @param range Start and end time for the constant series
 */
export function getFlotPairsConstant(seriesData: GraphSeriesValue[][], range: TimeRange): GraphSeriesValue[][] {
  if (!range.from || !range.to || !seriesData || seriesData.length === 0) {
    return [];
  }

  const from = range.from.valueOf();
  const to = range.to.valueOf();
  const value = seriesData[0][1];
  return [
    [from, value],
    [to, value],
  ];
}
