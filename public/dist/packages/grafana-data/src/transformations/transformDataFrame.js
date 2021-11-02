import { __assign, __read, __spreadArray, __values } from "tslib";
import { of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { standardTransformersRegistry } from './standardTransformersRegistry';
var getOperator = function (config) { return function (source) {
    var _a;
    var info = standardTransformersRegistry.get(config.id);
    if (!info) {
        return source;
    }
    var defaultOptions = (_a = info.transformation.defaultOptions) !== null && _a !== void 0 ? _a : {};
    var options = __assign(__assign({}, defaultOptions), config.options);
    return source.pipe(mergeMap(function (before) { return of(before).pipe(info.transformation.operator(options), postProcessTransform(before, info)); }));
}; };
var postProcessTransform = function (before, info) { return function (source) {
    return source.pipe(map(function (after) {
        var e_1, _a;
        if (after === before) {
            return after;
        }
        try {
            // Add a key to the metadata if the data changed
            for (var after_1 = __values(after), after_1_1 = after_1.next(); !after_1_1.done; after_1_1 = after_1.next()) {
                var series = after_1_1.value;
                if (!series.meta) {
                    series.meta = {};
                }
                if (!series.meta.transformations) {
                    series.meta.transformations = [info.id];
                }
                else {
                    series.meta.transformations = __spreadArray(__spreadArray([], __read(series.meta.transformations), false), [info.id], false);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (after_1_1 && !after_1_1.done && (_a = after_1.return)) _a.call(after_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return after;
    }));
}; };
/**
 * Apply configured transformations to the input data
 */
export function transformDataFrame(options, data) {
    var stream = of(data);
    if (!options.length) {
        return stream;
    }
    var operators = [];
    for (var index = 0; index < options.length; index++) {
        var config = options[index];
        if (config.disabled) {
            continue;
        }
        operators.push(getOperator(config));
    }
    // @ts-ignore TypeScript has a hard time understanding this construct
    return stream.pipe.apply(stream, operators);
}
//# sourceMappingURL=transformDataFrame.js.map