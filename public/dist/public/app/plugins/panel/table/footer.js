import { FieldType, formattedValueToString, getDisplayProcessor, reduceField, fieldReducers, } from '@grafana/data';
import { config } from 'app/core/config';
export function getFooterCells(frame, options) {
    return frame.fields.map(function (field, i) {
        if (field.type !== FieldType.number) {
            // show the reducer in the first column
            if (i === 0 && options && options.reducer.length > 0) {
                var reducer = fieldReducers.get(options.reducer[0]);
                return reducer.name;
            }
            return undefined;
        }
        if ((options === null || options === void 0 ? void 0 : options.fields) && options.fields.length > 0) {
            var f = options.fields.find(function (f) { return f === field.name; });
            if (f) {
                return getFormattedValue(field, options.reducer);
            }
            return undefined;
        }
        return getFormattedValue(field, (options === null || options === void 0 ? void 0 : options.reducer) || []);
    });
}
function getFormattedValue(field, reducer) {
    var _a;
    var fmt = (_a = field.display) !== null && _a !== void 0 ? _a : getDisplayProcessor({ field: field, theme: config.theme2 });
    var calc = reducer[0];
    var v = reduceField({ field: field, reducers: reducer })[calc];
    return formattedValueToString(fmt(v));
}
//# sourceMappingURL=footer.js.map