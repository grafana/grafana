import { toOption as toOptionFromData, } from '@grafana/data';
export var QueryFormat;
(function (QueryFormat) {
    QueryFormat["Timeseries"] = "time_series";
    QueryFormat["Table"] = "table";
})(QueryFormat || (QueryFormat = {}));
export const QUERY_FORMAT_OPTIONS = [
    { label: 'Time series', value: QueryFormat.Timeseries },
    { label: 'Table', value: QueryFormat.Table },
];
const backWardToOption = (value) => ({ label: value, value });
export const toOption = toOptionFromData !== null && toOptionFromData !== void 0 ? toOptionFromData : backWardToOption;
//# sourceMappingURL=types.js.map