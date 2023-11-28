import { __rest } from "tslib";
import { FieldType, SortedVector } from '@grafana/data';
export var SortDirection;
(function (SortDirection) {
    SortDirection[SortDirection["Ascending"] = 0] = "Ascending";
    SortDirection[SortDirection["Descending"] = 1] = "Descending";
})(SortDirection || (SortDirection = {}));
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
function makeIndex(field, dir) {
    const fieldValues = field.values;
    const { nanos } = field;
    // we first build an array which is [0,1,2,3....]
    const index = Array(fieldValues.length);
    for (let i = 0; i < index.length; i++) {
        index[i] = i;
    }
    const isAsc = dir === SortDirection.Ascending;
    index.sort((a, b) => {
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
export function sortDataFrameByTime(frame, dir) {
    const { fields } = frame, rest = __rest(frame, ["fields"]);
    // we use the approach used in @grafana/data/sortDataframe.
    // we cannot use it directly, because it does not take `.nanos` into account
    // (see https://github.com/grafana/grafana/issues/72351).
    // we can switch to to @grafana/data/sortDataframe when the issue is fixed.
    const timeField = fields.find((field) => field.type === FieldType.time);
    if (timeField === undefined) {
        throw new Error('missing timestamp field. should never happen');
    }
    const index = makeIndex(timeField, dir);
    return Object.assign(Object.assign({}, rest), { fields: fields.map((field) => (Object.assign(Object.assign({}, field), { values: new SortedVector(field.values, index).toArray(), nanos: field.nanos === undefined ? undefined : new SortedVector(field.nanos, index).toArray() }))) });
    return frame;
}
//# sourceMappingURL=sortDataFrame.js.map