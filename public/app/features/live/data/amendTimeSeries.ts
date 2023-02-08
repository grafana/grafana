import { closestIdx } from "./StreamingDataFrame";

// prevData and nextData are assumed sorted ASC on reference [0] arrays
// nextData is assumed to be contiguous, only edges are checked for overlap
// ...so prev: [1,2,5] + next: [3,4,6] -> [1,2,3,4,6]
export function amendTimeSeries(prevData: [number[], any[]], nextData: [number[], any[]]): [number[], any[]] {
  let [pr, pv] = prevData ?? [[], []];
  let [nr, nv] = nextData ?? [[], []];

  let pLen = pr.length;
  let pStart = pr[0];
  let pEnd = pr[pLen - 1];

  let nLen = nr.length;
  let nStart = nr[0];
  let nEnd = nr[nLen - 1];

  let r: number[];
  let v: any[];

  if (pLen) {
    if (nLen) {
      // append, no overlap
      if (nStart > pEnd) {
        //	console.log('append, no overlap');
        r = pr.concat(nr);
        v = pv.concat(nv);
      }
      // prepend, no overlap
      else if (nEnd < pStart) {
        //	console.log('prepend, no overlap');
        r = nr.concat(pr);
        v = nv.concat(pv);
      }
      // full replace
      else if (nStart <= pStart && nEnd >= pEnd) {
        r = nr;
        v = nv;
      }
      // partial replace
      else if (nStart > pStart && nEnd < pEnd) {
      }
      // append, with overlap
      else if (nStart >= pStart) {
        //	console.log('append, with overlap');
        let idx = closestIdx(nStart, pr);
        idx = pr[idx] < nStart ? idx - 1 : idx;
        r = pr.slice(0, idx).concat(nr);
        v = pv.slice(0, idx).concat(nv);
      }
      // prepend, with overlap
      else if (nEnd >= pStart) {
        //	console.log('prepend, with overlap');
        let idx = closestIdx(nEnd, pr);
        idx = pr[idx] < nEnd ? idx : idx + 1;
        r = nr.concat(pr.slice(idx));
        v = nv.concat(pv.slice(idx));
      }
    } else {
      r = pr;
      v = pv;
    }
  } else {
    if (nLen) {
      r = nr;
      v = nv;
    } else {
      // defaulted to empty arrays, just reuse
      r = pr;
      v = pv;
    }
  }

  return [r!, v!];
}

type TimeSeries = [times: number[], vals: any[]];

export function trimTimeSeries(data: TimeSeries, fromTime: number, toTime: number): TimeSeries {
  let [times, vals] = data;
  let fromIdx;
  let toIdx;

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
    //	console.log('trim!', fromIdx ?? 0, toIdx);
    times = times.slice(fromIdx ?? 0, toIdx);
    vals = vals.slice(fromIdx ?? 0, toIdx);
  }

  return [times, vals];
}
