import { __assign, __values } from "tslib";
import { map } from 'rxjs/operators';
import { ArrayVector, DataTransformerID, FieldMatcherID, getFieldDisplayName, getFieldMatcher, reduceField, } from '@grafana/data';
import { getFieldConfigFromFrame, evaluteFieldMappings, } from '../fieldToConfigMapping/fieldToConfigMapping';
export function extractConfigFromQuery(options, data) {
    var e_1, _a, e_2, _b, e_3, _c, e_4, _d;
    var _e;
    var configFrame = null;
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var frame = data_1_1.value;
            if (frame.refId === options.configRefId) {
                configFrame = frame;
                break;
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
    if (!configFrame) {
        return data;
    }
    var reducedConfigFrame = {
        fields: [],
        length: 1,
    };
    var mappingResult = evaluteFieldMappings(configFrame, (_e = options.mappings) !== null && _e !== void 0 ? _e : [], false);
    try {
        // reduce config frame
        for (var _f = __values(configFrame.fields), _g = _f.next(); !_g.done; _g = _f.next()) {
            var field = _g.value;
            var newField = __assign({}, field);
            var fieldName = getFieldDisplayName(field, configFrame);
            var fieldMapping = mappingResult.index[fieldName];
            var result = reduceField({ field: field, reducers: [fieldMapping.reducerId] });
            newField.values = new ArrayVector([result[fieldMapping.reducerId]]);
            reducedConfigFrame.fields.push(newField);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
        }
        finally { if (e_2) throw e_2.error; }
    }
    var output = [];
    var matcher = getFieldMatcher(options.applyTo || { id: FieldMatcherID.numeric });
    try {
        for (var data_2 = __values(data), data_2_1 = data_2.next(); !data_2_1.done; data_2_1 = data_2.next()) {
            var frame = data_2_1.value;
            // Skip config frame in output
            if (frame === configFrame && data.length > 1) {
                continue;
            }
            var outputFrame = {
                fields: [],
                length: frame.length,
            };
            try {
                for (var _h = (e_4 = void 0, __values(frame.fields)), _j = _h.next(); !_j.done; _j = _h.next()) {
                    var field = _j.value;
                    if (matcher(field, frame, data)) {
                        var dataConfig = getFieldConfigFromFrame(reducedConfigFrame, 0, mappingResult);
                        outputFrame.fields.push(__assign(__assign({}, field), { config: __assign(__assign({}, field.config), dataConfig) }));
                    }
                    else {
                        outputFrame.fields.push(field);
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (_j && !_j.done && (_d = _h.return)) _d.call(_h);
                }
                finally { if (e_4) throw e_4.error; }
            }
            output.push(outputFrame);
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (data_2_1 && !data_2_1.done && (_c = data_2.return)) _c.call(data_2);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return output;
}
export var configFromDataTransformer = {
    id: DataTransformerID.configFromData,
    name: 'Config from query results',
    description: 'Set unit, min, max and more from data',
    defaultOptions: {
        configRefId: 'config',
        mappings: [],
    },
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) { return source.pipe(map(function (data) { return extractConfigFromQuery(options, data); })); }; },
};
//# sourceMappingURL=configFromQuery.js.map