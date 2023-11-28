import { __rest } from "tslib";
import { isString } from 'lodash';
import { of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { AnnotationEventFieldSource, FieldType, getFieldDisplayName, standardTransformers, } from '@grafana/data';
import { config } from 'app/core/config';
export const standardAnnotationSupport = {
    /**
     * Assume the stored value is standard model.
     */
    prepareAnnotation: (json) => {
        if (isString(json === null || json === void 0 ? void 0 : json.query)) {
            const { query } = json, rest = __rest(json, ["query"]);
            return Object.assign(Object.assign({}, rest), { target: {
                    refId: 'annotation_query',
                    query,
                }, mappings: {} });
        }
        return json;
    },
    /**
     * Default will just return target from the annotation.
     */
    prepareQuery: (anno) => anno.target,
    /**
     * Provides default processing from dataFrame to annotation events.
     */
    processEvents: (anno, data) => {
        return getAnnotationsFromData(data, anno.mappings);
    },
};
/**
 * Flatten all frames into a single frame with mergeTransformer.
 */
export function singleFrameFromPanelData() {
    return (source) => source.pipe(mergeMap((data) => {
        if (!(data === null || data === void 0 ? void 0 : data.length)) {
            return of(undefined);
        }
        if (data.length === 1) {
            return of(data[0]);
        }
        const ctx = {
            interpolate: (v) => v,
        };
        return of(data).pipe(standardTransformers.mergeTransformer.operator({}, ctx), map((d) => d[0]));
    }));
}
// These fields get added to the standard UI
export const annotationEventNames = [
    {
        key: 'time',
        field: (frame) => frame.fields.find((f) => f.type === FieldType.time),
        placeholder: 'time, or the first time field',
    },
    { key: 'timeEnd', label: 'end time', help: 'When this field is defined, the annotation will be treated as a range' },
    {
        key: 'title',
    },
    {
        key: 'text',
        field: (frame) => frame.fields.find((f) => f.type === FieldType.string),
        placeholder: 'text, or the first text field',
    },
    { key: 'tags', split: ',', help: 'The results will be split on comma (,)' },
    {
        key: 'id',
    },
];
export const publicDashboardEventNames = [
    {
        key: 'color',
    },
    {
        key: 'isRegion',
    },
    {
        key: 'source',
    },
];
// Given legacy infrastructure, alert events are passed though the same annotation
// pipeline, but include fields that should not be exposed generally
const alertEventAndAnnotationFields = [
    ...(config.publicDashboardAccessToken ? publicDashboardEventNames : []),
    ...annotationEventNames,
    { key: 'userId' },
    { key: 'login' },
    { key: 'email' },
    { key: 'prevState' },
    { key: 'newState' },
    { key: 'data' },
    { key: 'panelId' },
    { key: 'alertId' },
    { key: 'dashboardId' },
    { key: 'dashboardUID' },
];
export function getAnnotationsFromData(data, options) {
    return of(data).pipe(singleFrameFromPanelData(), map((frame) => {
        if (!(frame === null || frame === void 0 ? void 0 : frame.length)) {
            return [];
        }
        let hasTime = false;
        let hasText = false;
        const byName = {};
        for (const f of frame.fields) {
            const name = getFieldDisplayName(f, frame);
            byName[name.toLowerCase()] = f;
        }
        if (!options) {
            options = {};
        }
        const fields = [];
        for (const evts of alertEventAndAnnotationFields) {
            const opt = options[evts.key] || {}; //AnnotationEventFieldMapping
            if (opt.source === AnnotationEventFieldSource.Skip) {
                continue;
            }
            const setter = { key: evts.key, split: evts.split };
            if (opt.source === AnnotationEventFieldSource.Text) {
                setter.text = opt.value;
            }
            else {
                const lower = (opt.value || evts.key).toLowerCase();
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
        if (!hasTime || !hasText) {
            console.error('Cannot process annotation fields. No time or text present.');
            return [];
        }
        // Add each value to the string
        const events = [];
        for (let i = 0; i < frame.length; i++) {
            const anno = {
                type: 'default',
                color: 'red',
            };
            for (const f of fields) {
                let v = undefined;
                if (f.text) {
                    v = f.text; // TODO support templates!
                }
                else if (f.field) {
                    v = f.field.values[i];
                    if (v !== undefined && f.regex) {
                        const match = f.regex.exec(v);
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
            events.push(anno);
        }
        return events;
    }));
}
// These opt outs are here only for quicker and easier migration to react based annotations editors and because
// annotation support API needs some work to support less "standard" editors like prometheus and here it is not
// polluting public API.
const legacyRunner = [
    'prometheus',
    'loki',
    'elasticsearch',
    'grafana-opensearch-datasource', // external
];
/**
 * Opt out of using the default mapping functionality on frontend.
 */
export function shouldUseMappingUI(datasource) {
    const { type } = datasource;
    return !(type === 'datasource' || //  ODD behavior for "-- Grafana --" datasource
        legacyRunner.includes(type));
}
/**
 * Use legacy runner. Used only as an escape hatch for easier transition to React based annotation editor.
 */
export function shouldUseLegacyRunner(datasource) {
    const { type } = datasource;
    return legacyRunner.includes(type);
}
//# sourceMappingURL=standardAnnotationSupport.js.map