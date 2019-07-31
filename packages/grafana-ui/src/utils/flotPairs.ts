// Types
import { GraphSeriesValue } from '../types/index';
import { NullValueMode, DataFrame } from '@grafana/data';

export interface FlotPairsOptions {
  series: DataFrame;
  xIndex: number;
  yIndex: number;
  nullValueMode?: NullValueMode;
}

export function getFlotPairs({ series, xIndex, yIndex, nullValueMode }: FlotPairsOptions): GraphSeriesValue[][] {
  const vX = series.fields[xIndex].values;
  const vY = series.fields[yIndex].values;
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
