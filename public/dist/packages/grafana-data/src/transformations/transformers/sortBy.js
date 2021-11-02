import { __assign } from "tslib";
import { map } from 'rxjs/operators';
import { DataTransformerID } from './ids';
import { getFieldDisplayName } from '../../field';
import { sortDataFrame } from '../../dataframe';
export var sortByTransformer = {
    id: DataTransformerID.sortBy,
    name: 'Sort by',
    description: 'Sort fields in a frame',
    defaultOptions: {
        fields: {},
    },
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) {
        return source.pipe(map(function (data) {
            var _a;
            if (!Array.isArray(data) || data.length === 0 || !((_a = options === null || options === void 0 ? void 0 : options.sort) === null || _a === void 0 ? void 0 : _a.length)) {
                return data;
            }
            return sortDataFrames(data, options.sort);
        }));
    }; },
};
export function sortDataFrames(data, sort) {
    return data.map(function (frame) {
        var s = attachFieldIndex(frame, sort);
        if (s.length && s[0].index != null) {
            return sortDataFrame(frame, s[0].index, s[0].desc);
        }
        return frame;
    });
}
function attachFieldIndex(frame, sort) {
    return sort.map(function (s) {
        if (s.index != null) {
            // null or undefined
            return s;
        }
        return __assign(__assign({}, s), { index: frame.fields.findIndex(function (f) { return s.field === getFieldDisplayName(f, frame); }) });
    });
}
//# sourceMappingURL=sortBy.js.map