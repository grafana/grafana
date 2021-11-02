import { __assign, __values } from "tslib";
import { map } from 'rxjs/operators';
import { FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { ArrayVector } from '../../vector';
export var labelsToFieldsTransformer = {
    id: DataTransformerID.labelsToFields,
    name: 'Labels to fields',
    description: 'Extract time series labels to fields (columns)',
    defaultOptions: {},
    operator: function (options) { return function (source) { return source.pipe(map(function (data) { return labelsToFieldsTransformer.transformer(options)(data); })); }; },
    transformer: function (options) { return function (data) {
        var e_1, _a, e_2, _b, e_3, _c, e_4, _d;
        var result = [];
        try {
            for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                var frame = data_1_1.value;
                var newFields = [];
                var uniqueLabels = {};
                try {
                    for (var _e = (e_2 = void 0, __values(frame.fields)), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var field = _f.value;
                        if (!field.labels) {
                            newFields.push(field);
                            continue;
                        }
                        var sansLabels = __assign(__assign({}, field), { config: __assign(__assign({}, field.config), { 
                                // we need to clear thes for this transform as these can contain label names that we no longer want
                                displayName: undefined, displayNameFromDS: undefined }), labels: undefined });
                        newFields.push(sansLabels);
                        try {
                            for (var _g = (e_3 = void 0, __values(Object.keys(field.labels))), _h = _g.next(); !_h.done; _h = _g.next()) {
                                var labelName = _h.value;
                                // if we should use this label as the value field name store it and skip adding this as a separate field
                                if (options.valueLabel === labelName) {
                                    sansLabels.name = field.labels[labelName];
                                    continue;
                                }
                                var uniqueValues = (uniqueLabels[labelName] || (uniqueLabels[labelName] = new Set()));
                                uniqueValues.add(field.labels[labelName]);
                            }
                        }
                        catch (e_3_1) { e_3 = { error: e_3_1 }; }
                        finally {
                            try {
                                if (_h && !_h.done && (_c = _g.return)) _c.call(_g);
                            }
                            finally { if (e_3) throw e_3.error; }
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                for (var name_1 in uniqueLabels) {
                    try {
                        for (var _j = (e_4 = void 0, __values(uniqueLabels[name_1])), _k = _j.next(); !_k.done; _k = _j.next()) {
                            var value = _k.value;
                            var values = new Array(frame.length).fill(value);
                            newFields.push({
                                name: name_1,
                                type: FieldType.string,
                                values: new ArrayVector(values),
                                config: {},
                            });
                        }
                    }
                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                    finally {
                        try {
                            if (_k && !_k.done && (_d = _j.return)) _d.call(_j);
                        }
                        finally { if (e_4) throw e_4.error; }
                    }
                }
                result.push({
                    fields: newFields,
                    length: frame.length,
                });
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return result;
    }; },
};
//# sourceMappingURL=labelsToFields.js.map