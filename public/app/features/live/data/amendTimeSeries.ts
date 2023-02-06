import { closestIdx } from "./StreamingDataFrame";

// prevData and nextData are assumed sorted ASC on reference [0] arrays
// nextData is assumed to be contiguous, only edges are checked for overlap
// ...so prev: [1,2,5] + next: [3,4,6] -> [1,2,3,4,6]
export function amendTimeSeries(prevData: [number[], any[]], nextData: [number[], any[]], fromRef: number, toRef: number): [number[], any[]] {
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

  let trimFrom;
  let trimTo;

  // trim to bounds
  if (r![0] < fromRef) {
    trimFrom = closestIdx(fromRef, r!);

    if (r![trimFrom] < fromRef) {
      trimFrom++;
    }
  }

  if (r![r!.length - 1] > toRef) {
    trimTo = closestIdx(toRef, r!);

    if (r![trimTo] > toRef) {
      trimTo--;
    }
  }

  if (trimFrom != null || trimTo != null) {
    //	console.log('trim!', trimFrom ?? 0, trimTo);
    r = r!.slice(trimFrom ?? 0, trimTo);
    v = v!.slice(trimFrom ?? 0, trimTo);
  }

  return [r!, v!];
}
