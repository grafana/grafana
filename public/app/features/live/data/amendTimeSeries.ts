import { closestIdx } from "./StreamingDataFrame";

export type Table = [times: number[], ...values: any[][]];

// prevTable and nextTable are assumed sorted ASC on reference [0] arrays
// nextTable is assumed to be contiguous, only edges are checked for overlap
// ...so prev: [1,2,5] + next: [3,4,6] -> [1,2,3,4,6]
export function amendTable(prevTable: Table, nextTable: Table): Table {
  let [prevTimes] = prevTable;
  let [nextTimes] = nextTable;

  let pLen = prevTimes.length;
  let pStart = prevTimes[0];
  let pEnd = prevTimes[pLen - 1];

  let nLen = nextTimes.length;
  let nStart = nextTimes[0];
  let nEnd = nextTimes[nLen - 1];

  let outTable: Table;

  if (pLen) {
    if (nLen) {
      // append, no overlap
      if (nStart > pEnd) {
        outTable = prevTable.map((_, i) => prevTable[i].concat(nextTable[i])) as Table;
      }
      // prepend, no overlap
      else if (nEnd < pStart) {
        outTable = nextTable.map((_, i) => nextTable[i].concat(prevTable[i])) as Table;
      }
      // full replace
      else if (nStart <= pStart && nEnd >= pEnd) {
        outTable = nextTable;
      }
      // partial replace
      else if (nStart > pStart && nEnd < pEnd) {
      }
      // append, with overlap
      else if (nStart >= pStart) {
        let idx = closestIdx(nStart, prevTimes);
        idx = prevTimes[idx] < nStart ? idx - 1 : idx;
        outTable = prevTable.map((_, i) => prevTable[i].slice(0, idx).concat(nextTable[i])) as Table;
      }
      // prepend, with overlap
      else if (nEnd >= pStart) {
        let idx = closestIdx(nEnd, prevTimes);
        idx = prevTimes[idx] < nEnd ? idx : idx + 1;
        outTable = nextTable.map((_, i) => nextTable[i].concat(prevTable[i].slice(idx))) as Table;
      }
    } else {
      outTable = prevTable;
    }
  } else {
    if (nLen) {
      outTable = nextTable;
    } else {
      outTable = [[]];
    }
  }

  return outTable!;
}

export function trimTable(table: Table, fromTime: number, toTime: number): Table {
  let [times, ...vals] = table;
  let fromIdx: number | undefined;
  let toIdx: number | undefined;

  // trim to bounds
  if (times[0] < fromTime) {
    fromIdx = closestIdx(fromTime, times);

    if (times[fromIdx] < fromTime) {
      fromIdx++;
    }
  }

  if (times[times.length - 1] > toTime) {
    toIdx = closestIdx(toTime, times);

    if (times[toIdx] > toTime) {
      toIdx--;
    }
  }

  if (fromIdx != null || toIdx != null) {
    times = times.slice(fromIdx ?? 0, toIdx);
    vals = vals.map(vals2 => vals2.slice(fromIdx ?? 0, toIdx));
  }

  return [times, ...vals];
}
