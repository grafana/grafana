import { map } from 'rxjs';
import { DataTransformerID, getFieldMatcher, } from '@grafana/data';
import { getMatcherConfig } from '@grafana/data/src/transformations/transformers/filterByName';
import { noopTransformer } from '@grafana/data/src/transformations/transformers/noop';
import { partition } from './partition';
const defaultFrameNameOptions = {
    asLabels: true,
    append: false,
    withNames: false,
    separator1: '=',
    separator2: ' ',
};
function buildFrameName(opts, names, values) {
    return names
        .map((name, i) => (opts.withNames ? `${name}${opts.separator1}${values[i]}` : values[i]))
        .join(opts.separator2);
}
function buildFieldLabels(names, values) {
    const labels = {};
    names.forEach((name, i) => {
        labels[name] = String(values[i]);
    });
    return labels;
}
export const partitionByValuesTransformer = {
    id: DataTransformerID.partitionByValues,
    name: 'Partition by values',
    description: `Splits a one-frame dataset into multiple series discriminated by unique/enum values in one or more fields.`,
    defaultOptions: {},
    operator: (options, ctx) => (source) => source.pipe(map((data) => partitionByValuesTransformer.transformer(options, ctx)(data))),
    transformer: (options, ctx) => {
        const matcherConfig = getMatcherConfig(ctx, { names: options.fields });
        if (!matcherConfig) {
            return noopTransformer.transformer({}, ctx);
        }
        const matcher = getFieldMatcher(matcherConfig);
        return (data) => {
            if (!data.length) {
                return data;
            }
            // error if > 1 frame?
            return partitionByValues(data[0], matcher, options);
        };
    },
};
// Split a single frame dataset into multiple frames based on values in a set of fields
export function partitionByValues(frame, matcher, options) {
    const keyFields = frame.fields.filter((f) => matcher(f, frame, [frame]));
    if (!keyFields.length) {
        return [frame];
    }
    const keyFieldsVals = keyFields.map((f) => f.values);
    const names = keyFields.map((f) => f.name);
    const frameNameOpts = Object.assign(Object.assign({}, defaultFrameNameOptions), options === null || options === void 0 ? void 0 : options.naming);
    return partition(keyFieldsVals).map((idxs) => {
        let frameName = frame.name;
        let fieldLabels = {};
        if (frameNameOpts.asLabels) {
            fieldLabels = buildFieldLabels(names, keyFields.map((f, i) => keyFieldsVals[i][idxs[0]]));
        }
        else {
            let name = buildFrameName(frameNameOpts, names, keyFields.map((f, i) => keyFieldsVals[i][idxs[0]]));
            if ((frameNameOpts === null || frameNameOpts === void 0 ? void 0 : frameNameOpts.append) && frame.name) {
                name = `${frame.name} ${name}`;
            }
            frameName = name;
        }
        let filteredFields = frame.fields;
        if (!(options === null || options === void 0 ? void 0 : options.keepFields)) {
            const keyFieldNames = new Set(names);
            filteredFields = frame.fields.filter((field) => !keyFieldNames.has(field.name));
        }
        return {
            name: frameName,
            meta: frame.meta,
            length: idxs.length,
            fields: filteredFields.map((f) => {
                const vals = f.values;
                const vals2 = Array(idxs.length);
                for (let i = 0; i < idxs.length; i++) {
                    vals2[i] = vals[idxs[i]];
                }
                return {
                    name: f.name,
                    type: f.type,
                    config: f.config,
                    labels: Object.assign(Object.assign({}, f.labels), fieldLabels),
                    values: vals2,
                };
            }),
        };
    });
}
//# sourceMappingURL=partitionByValues.js.map