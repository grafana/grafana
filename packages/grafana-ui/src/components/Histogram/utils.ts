export function incrRound(num: number, incr: number) {
  return Math.round(num / incr) * incr;
}

export function incrRoundUp(num: number, incr: number) {
  return Math.ceil(num / incr) * incr;
}

export function incrRoundDn(num: number, incr: number) {
  return Math.floor(num / incr) * incr;
}

export function histogram(
  vals: number[],
  round: (v: number) => number,
  filter?: any[] | null,
  sort?: ((a: any, b: any) => number) | null
) {
  let hist = new Map();

  for (let i = 0; i < vals.length; i++) {
    let v = vals[i];

    if (v != null) {
      v = round(v);
    }

    let entry = hist.get(v);

    if (entry) {
      entry.count++;
    } else {
      hist.set(v, { value: v, count: 1 });
    }
  }

  filter && filter.forEach((v) => hist.delete(v));

  let bins = [...hist.values()];

  sort && bins.sort((a, b) => sort(a.value, b.value));

  let values = Array(bins.length);
  let counts = Array(bins.length);

  for (let i = 0; i < bins.length; i++) {
    values[i] = bins[i].value;
    counts[i] = bins[i].count;
  }

  return [values, counts];
}
