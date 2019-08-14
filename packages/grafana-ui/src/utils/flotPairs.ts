// Types
import { NullValueMode, GraphSeriesValue } from '@grafana/data';

export interface FlotPairsOptions {
  rows: any[][];
  xIndex: number;
  yIndex: number;
  nullValueMode?: NullValueMode;
}

export function getFlotPairs({ rows, xIndex, yIndex, nullValueMode }: FlotPairsOptions): GraphSeriesValue[][] {
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
