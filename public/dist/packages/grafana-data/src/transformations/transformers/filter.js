import { __assign, __values } from "tslib";
import { map } from 'rxjs/operators';
import { noopTransformer } from './noop';
import { DataTransformerID } from './ids';
import { getFieldMatcher, getFrameMatchers } from '../matchers';
export var filterFieldsTransformer = {
    id: DataTransformerID.filterFields,
    name: 'Filter Fields',
    description: 'select a subset of fields',
    defaultOptions: {},
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) {
        if (!options.include && !options.exclude) {
            return source.pipe(noopTransformer.operator({}));
        }
        return source.pipe(map(function (data) {
            var e_1, _a;
            var include = options.include ? getFieldMatcher(options.include) : null;
            var exclude = options.exclude ? getFieldMatcher(options.exclude) : null;
            var processed = [];
            try {
                for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                    var series = data_1_1.value;
                    // Find the matching field indexes
                    var fields = [];
                    for (var i = 0; i < series.fields.length; i++) {
                        var field = series.fields[i];
                        if (exclude) {
                            if (exclude(field, series, data)) {
                                continue;
                            }
                            if (!include) {
                                fields.push(field);
                            }
                        }
                        if (include && include(field, series, data)) {
                            fields.push(field);
                        }
                    }
                    if (!fields.length) {
                        continue;
                    }
                    var copy = __assign(__assign({}, series), { // all the other properties
                        fields: fields });
                    processed.push(copy);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return processed;
        }));
    }; },
};
export var filterFramesTransformer = {
    id: DataTransformerID.filterFrames,
    name: 'Filter Frames',
    description: 'select a subset of frames',
    defaultOptions: {},
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) {
        if (!options.include && !options.exclude) {
            return source.pipe(noopTransformer.operator({}));
        }
        return source.pipe(map(function (data) {
            var e_2, _a;
            var include = options.include ? getFrameMatchers(options.include) : null;
            var exclude = options.exclude ? getFrameMatchers(options.exclude) : null;
            var processed = [];
            try {
                for (var data_2 = __values(data), data_2_1 = data_2.next(); !data_2_1.done; data_2_1 = data_2.next()) {
                    var series = data_2_1.value;
                    if (exclude) {
                        if (exclude(series)) {
                            continue;
                        }
                        if (!include) {
                            processed.push(series);
                        }
                    }
                    if (include && include(series)) {
                        processed.push(series);
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (data_2_1 && !data_2_1.done && (_a = data_2.return)) _a.call(data_2);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return processed;
        }));
    }; },
};
//# sourceMappingURL=filter.js.map