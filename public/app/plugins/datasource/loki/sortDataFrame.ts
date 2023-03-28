import { DataFrame, Field, SortedVector } from '@grafana/data';

type SortDirection = 'ASCENDING' | 'DESCENDING';

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
function makeIndex(field: Field<string>, dir: SortDirection): number[] {
  const fieldValues: string[] = field.values.toArray();

  // we first build an array which is [0,1,2,3....]
  const index = Array(fieldValues.length);
  for (let i = 0; i < index.length; i++) {
    index[i] = i;
  }

  const isAsc = dir === 'ASCENDING';

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

    return 0;
  });

  return index;
}

// sort a dataframe that is in the Loki format ascending or descending,
// based on the nanosecond-timestamp
export function sortDataFrameByTime(frame: DataFrame, dir: SortDirection): DataFrame {
  const { fields, ...rest } = frame;

  // we use the approach used in @grafana/data/sortDataframe.
  // we cannot use it directly, because our tsNs field has a type=time,
  // so we have to build the `index` manually.

  const tsNsField = fields.find((field) => field.name === 'tsNs');
  if (tsNsField === undefined) {
    throw new Error('missing nanosecond-timestamp field. should never happen');
  }

  const index = makeIndex(tsNsField, dir);

  return {
    ...rest,
    fields: fields.map((field) => ({
      ...field,
      values: new SortedVector(field.values, index),
    })),
  };

  return frame;
}
