import { roundDecimals } from '@grafana/data';
/**
 * ⚠️ `frame.fields` could be an empty array ⚠️
 *
 * TypeScript will NOT complain about it when accessing items via index signatures.
 * Make sure to check for empty array or use optional chaining!
 *
 * see https://github.com/Microsoft/TypeScript/issues/13778
 */
const getSeriesName = (frame) => {
    var _a, _b, _c;
    const firstField = frame.fields[0];
    const displayNameFromDS = (_a = firstField === null || firstField === void 0 ? void 0 : firstField.config) === null || _a === void 0 ? void 0 : _a.displayNameFromDS;
    return (_b = displayNameFromDS !== null && displayNameFromDS !== void 0 ? displayNameFromDS : frame.name) !== null && _b !== void 0 ? _b : (_c = firstField === null || firstField === void 0 ? void 0 : firstField.labels) === null || _c === void 0 ? void 0 : _c.__name__;
};
const getSeriesValue = (frame) => {
    var _a;
    const value = (_a = frame.fields[0]) === null || _a === void 0 ? void 0 : _a.values[0];
    if (Number.isFinite(value)) {
        return roundDecimals(value, 5);
    }
    return value;
};
const getSeriesLabels = (frame) => {
    var _a;
    const firstField = frame.fields[0];
    return (_a = firstField === null || firstField === void 0 ? void 0 : firstField.labels) !== null && _a !== void 0 ? _a : {};
};
const formatLabels = (labels) => {
    return Object.entries(labels)
        .map(([key, value]) => key + '=' + value)
        .join(', ');
};
const isEmptySeries = (series) => {
    const isEmpty = series.every((serie) => serie.fields.every((field) => field.values.every((value) => value == null)));
    return isEmpty;
};
export { getSeriesName, getSeriesValue, getSeriesLabels, formatLabels, isEmptySeries };
//# sourceMappingURL=util.js.map