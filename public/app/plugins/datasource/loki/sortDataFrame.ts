import { DataFrame, Field, FieldType } from '@grafana/data';

export enum SortDirection {
  Ascending,
  Descending,
}

// creates the `index` for the sorting.
// this is needed by the `SortedVector`.
// the index is an array of numbers, and it defines an order.
// at every slot in the index the values is the position of
// the sorted item.
// for example, an index of [3,1,2] means that
// in the dataframe, that has 3 rows, after sorting:
// - the third row will become the first
// - the first row will become the second
// - the second row will become the third
function makeIndex(field: Field<number>, dir: SortDirection): number[] {
  const fieldValues: number[] = field.values;
  const { nanos } = field;

  // we first build an array which is [0,1,2,3....]
  const index = Array(fieldValues.length);
  for (let i = 0; i < index.length; i++) {
    index[i] = i;
  }

  const isAsc = dir === SortDirection.Ascending;

  index.sort((a: number, b: number): number => {
    // we need to answer this question:
    // in the field-used-for-sorting, how would we compare value-at-index-a to value-at-index-b?
    const valA = fieldValues[a];
    const valB = fieldValues[b];
    if (valA < valB) {
      return isAsc ? -1 : 1;
    }

    if (valA > valB) {
      return isAsc ? 1 : -1;
    }

    // the millisecond timestamps are equal,
    // compare the nanosecond part, if available

    if (nanos === undefined) {
      return 0;
    }

    const nanoA = nanos[a];
    const nanoB = nanos[b];

    if (nanoA < nanoB) {
      return isAsc ? -1 : 1;
    }

    if (nanoA > nanoB) {
      return isAsc ? 1 : -1;
    }

    return 0;
  });

  return index;
}

// sort a dataframe that is in the Loki dataframe format ascending or desceding based on time,
// with nanosecond precision.
export function sortDataFrameByTime(frame: DataFrame, dir: SortDirection): DataFrame {
  const { fields, ...rest } = frame;

  // we use the approach used in @grafana/data/sortDataframe.
  // we cannot use it directly, because it does not take `.nanos` into account
  // (see https://github.com/grafana/grafana/issues/72351).
  // we can switch to to @grafana/data/sortDataframe when the issue is fixed.

  const timeField = fields.find((field) => field.type === FieldType.time);
  if (timeField === undefined) {
    throw new Error('missing timestamp field. should never happen');
  }

  const index = makeIndex(timeField, dir);

  return {
    ...rest,
    fields: fields.map((field) => ({
      ...field,
      values: sorted(field.values, index),
      nanos: field.nanos === undefined ? undefined : sorted(field.nanos, index),
    })),
  };
}

function sorted<T>(vals: T[], index: number[]): T[] {
  return vals.map((_, idx) => vals[index[idx]]);
}
