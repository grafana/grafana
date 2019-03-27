// Types
import { NullValueMode, GraphSeriesValue, SeriesData } from '../types/index';

export interface FlotPairsOptions {
  series: SeriesData;
  xIndex: number;
  yIndex: number;
  nullValueMode?: NullValueMode;
}

export function getFlotPairs({ series, xIndex, yIndex, nullValueMode }: FlotPairsOptions): GraphSeriesValue[][] {
  const rows = series.rows;

  const ignoreNulls = nullValueMode === NullValueMode.Ignore;
  const nullAsZero = nullValueMode === NullValueMode.AsZero;

  const pairs: any[][] = [];

  for (let i = 0; i < rows.length; i++) {
    const x = rows[i][xIndex];
    let y = rows[i][yIndex];

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
