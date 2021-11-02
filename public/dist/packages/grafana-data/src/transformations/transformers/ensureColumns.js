import { __values } from "tslib";
import { seriesToColumnsTransformer } from './seriesToColumns';
import { getTimeField } from '../../dataframe/processDataFrame';
import { DataTransformerID } from './ids';
import { map } from 'rxjs/operators';
export var ensureColumnsTransformer = {
    id: DataTransformerID.ensureColumns,
    name: 'Ensure Columns Transformer',
    description: 'Will check if current data frames is series or columns. If in series it will convert to columns.',
    operator: function (options) { return function (source) { return source.pipe(map(function (data) { return ensureColumnsTransformer.transformer(options)(data); })); }; },
    transformer: function (options) { return function (frames) {
        // Assume timeseries should first be joined by time
        var timeFieldName = findConsistentTimeFieldName(frames);
        if (frames.length > 1 && timeFieldName) {
            return seriesToColumnsTransformer.transformer({
                byField: timeFieldName,
            })(frames);
        }
        return frames;
    }; },
};
/**
 * Find the name for the time field used in all frames (if one exists)
 */
function findConsistentTimeFieldName(data) {
    var e_1, _a;
    var name = undefined;
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var frame = data_1_1.value;
            var timeField = getTimeField(frame).timeField;
            if (!timeField) {
                return undefined; // Not timeseries
            }
            if (!name) {
                name = timeField.name;
            }
            else if (name !== timeField.name) {
                // Second frame has a different time column?!
                return undefined;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return name;
}
//# sourceMappingURL=ensureColumns.js.map