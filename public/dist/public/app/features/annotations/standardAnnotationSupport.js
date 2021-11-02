import { __assign, __read, __rest, __spreadArray, __values } from "tslib";
import { of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { AnnotationEventFieldSource, FieldType, getFieldDisplayName, standardTransformers, } from '@grafana/data';
import { isString } from 'lodash';
export var standardAnnotationSupport = {
    /**
     * Assume the stored value is standard model.
     */
    prepareAnnotation: function (json) {
        if (isString(json === null || json === void 0 ? void 0 : json.query)) {
            var query = json.query, rest = __rest(json, ["query"]);
            return __assign(__assign({}, rest), { target: {
                    query: query,
                }, mappings: {} });
        }
        return json;
    },
    /**
     * Convert the stored JSON model and environment to a standard data source query object.
     * This query will be executed in the data source and the results converted into events.
     * Returning an undefined result will quietly skip query execution
     */
    prepareQuery: function (anno) { return anno.target; },
    /**
     * When the standard frame > event processing is insufficient, this allows explicit control of the mappings
     */
    processEvents: function (anno, data) {
        return getAnnotationsFromData(data, anno.mappings);
    },
};
/**
 * Flatten all panel data into a single frame
 */
export function singleFrameFromPanelData() {
    return function (source) {
        return source.pipe(mergeMap(function (data) {
            if (!(data === null || data === void 0 ? void 0 : data.length)) {
                return of(undefined);
            }
            if (data.length === 1) {
                return of(data[0]);
            }
            return of(data).pipe(standardTransformers.mergeTransformer.operator({}), map(function (d) { return d[0]; }));
        }));
    };
}
// These fields get added to the standard UI
export var annotationEventNames = [
    {
        key: 'time',
        field: function (frame) { return frame.fields.find(function (f) { return f.type === FieldType.time; }); },
        placeholder: 'time, or the first time field',
    },
    { key: 'timeEnd', help: 'When this field is defined, the annotation will be treated as a range' },
    {
        key: 'title',
    },
    {
        key: 'text',
        field: function (frame) { return frame.fields.find(function (f) { return f.type === FieldType.string; }); },
        placeholder: 'text, or the first text field',
    },
    { key: 'tags', split: ',', help: 'The results will be split on comma (,)' },
    {
        key: 'id',
    },
];
// Given legacy infrastructure, alert events are passed though the same annotation
// pipeline, but include fields that should not be exposed generally
var alertEventAndAnnotationFields = __spreadArray(__spreadArray([], __read(annotationEventNames), false), [
    { key: 'userId' },
    { key: 'login' },
    { key: 'email' },
    { key: 'prevState' },
    { key: 'newState' },
    { key: 'data' },
    { key: 'panelId' },
    { key: 'alertId' },
], false);
export function getAnnotationsFromData(data, options) {
    return of(data).pipe(singleFrameFromPanelData(), map(function (frame) {
        var e_1, _a, e_2, _b, e_3, _c;
        if (!(frame === null || frame === void 0 ? void 0 : frame.length)) {
            return [];
        }
        var hasTime = false;
        var hasText = false;
        var byName = {};
        try {
            for (var _d = __values(frame.fields), _e = _d.next(); !_e.done; _e = _d.next()) {
                var f = _e.value;
                var name_1 = getFieldDisplayName(f, frame);
                byName[name_1.toLowerCase()] = f;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (!options) {
            options = {};
        }
        var fields = [];
        try {
            for (var alertEventAndAnnotationFields_1 = __values(alertEventAndAnnotationFields), alertEventAndAnnotationFields_1_1 = alertEventAndAnnotationFields_1.next(); !alertEventAndAnnotationFields_1_1.done; alertEventAndAnnotationFields_1_1 = alertEventAndAnnotationFields_1.next()) {
                var evts = alertEventAndAnnotationFields_1_1.value;
                var opt = options[evts.key] || {}; //AnnotationEventFieldMapping
                if (opt.source === AnnotationEventFieldSource.Skip) {
                    continue;
                }
                var setter = { key: evts.key, split: evts.split };
                if (opt.source === AnnotationEventFieldSource.Text) {
                    setter.text = opt.value;
                }
                else {
                    var lower = (opt.value || evts.key).toLowerCase();
                    setter.field = byName[lower];
                    if (!setter.field && evts.field) {
                        setter.field = evts.field(frame);
                    }
                }
                if (setter.field || setter.text) {
                    fields.push(setter);
                    if (setter.key === 'time') {
                        hasTime = true;
                    }
                    else if (setter.key === 'text') {
                        hasText = true;
                    }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (alertEventAndAnnotationFields_1_1 && !alertEventAndAnnotationFields_1_1.done && (_b = alertEventAndAnnotationFields_1.return)) _b.call(alertEventAndAnnotationFields_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        if (!hasTime || !hasText) {
            return []; // throw an error?
        }
        // Add each value to the string
        var events = [];
        for (var i = 0; i < frame.length; i++) {
            var anno = {
                type: 'default',
                color: 'red',
            };
            try {
                for (var fields_1 = (e_3 = void 0, __values(fields)), fields_1_1 = fields_1.next(); !fields_1_1.done; fields_1_1 = fields_1.next()) {
                    var f = fields_1_1.value;
                    var v = undefined;
                    if (f.text) {
                        v = f.text; // TODO support templates!
                    }
                    else if (f.field) {
                        v = f.field.values.get(i);
                        if (v !== undefined && f.regex) {
                            var match = f.regex.exec(v);
                            if (match) {
                                v = match[1] ? match[1] : match[0];
                            }
                        }
                    }
                    if (v !== null && v !== undefined) {
                        if (f.split && typeof v === 'string') {
                            v = v.split(',');
                        }
                        anno[f.key] = v;
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (fields_1_1 && !fields_1_1.done && (_c = fields_1.return)) _c.call(fields_1);
                }
                finally { if (e_3) throw e_3.error; }
            }
            events.push(anno);
        }
        return events;
    }));
}
//# sourceMappingURL=standardAnnotationSupport.js.map