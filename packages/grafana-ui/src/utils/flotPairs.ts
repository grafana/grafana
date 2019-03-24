// Types
import { NullValueMode } from '../types/index';

export interface FloatPairsOptions {
  rows: any[][];
  xIndex: number;
  yIndex: number;
  nullValueMode?: NullValueMode;
}

export function getFlotPairs({ rows, xIndex, yIndex, nullValueMode }: FloatPairsOptions): any[][] {
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
