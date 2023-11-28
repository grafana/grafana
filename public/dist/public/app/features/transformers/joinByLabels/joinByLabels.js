import { map } from 'rxjs/operators';
import { DataTransformerID, FieldType } from '@grafana/data';
import { getDistinctLabels } from '../utils';
export const joinByLabelsTransformer = {
    id: DataTransformerID.joinByLabels,
    name: 'Join by labels',
    description: 'Flatten labeled results into a table joined by labels.',
    defaultOptions: {},
    operator: (options, ctx) => (source) => source.pipe(map((data) => joinByLabelsTransformer.transformer(options, ctx)(data))),
    transformer: (options) => {
        return (data) => {
            if (!data || !data.length) {
                return data;
            }
            return [joinByLabels(options, data)];
        };
    },
};
export function joinByLabels(options, data) {
    var _a, _b, _c, _d;
    if (!((_a = options.value) === null || _a === void 0 ? void 0 : _a.length)) {
        return getErrorFrame('No value labele configured');
    }
    const distinctLabels = getDistinctLabels(data);
    if (distinctLabels.size < 1) {
        return getErrorFrame('No labels in result');
    }
    if (!distinctLabels.has(options.value)) {
        return getErrorFrame('Value label not found');
    }
    let join = ((_b = options.join) === null || _b === void 0 ? void 0 : _b.length) ? options.join : Array.from(distinctLabels);
    join = join.filter((f) => f !== options.value);
    const names = new Set();
    const found = new Map();
    const inputFields = {};
    for (const frame of data) {
        for (const field of frame.fields) {
            if (field.labels && field.type !== FieldType.time) {
                const keys = join.map((v) => field.labels[v]);
                const key = keys.join(',');
                let item = found.get(key);
                if (!item) {
                    item = {
                        keys,
                        values: {},
                    };
                    found.set(key, item);
                }
                const name = field.labels[options.value];
                const vals = field.values;
                const old = item.values[name];
                if (old) {
                    item.values[name] = old.concat(vals);
                }
                else {
                    item.values[name] = vals;
                }
                if (!inputFields[name]) {
                    inputFields[name] = field; // keep the config
                }
                names.add(name);
            }
        }
    }
    const allNames = Array.from(names);
    const joinValues = join.map(() => []);
    const nameValues = allNames.map(() => []);
    for (const item of found.values()) {
        let valueOffset = -1;
        let done = false;
        while (!done) {
            valueOffset++;
            done = true;
            for (let i = 0; i < join.length; i++) {
                joinValues[i].push(item.keys[i]);
            }
            for (let i = 0; i < allNames.length; i++) {
                const name = allNames[i];
                const values = (_c = item.values[name]) !== null && _c !== void 0 ? _c : [];
                nameValues[i].push(values[valueOffset]);
                if (values.length > valueOffset + 1) {
                    done = false;
                }
            }
        }
    }
    const frame = { fields: [], length: nameValues[0].length };
    for (let i = 0; i < join.length; i++) {
        frame.fields.push({
            name: join[i],
            config: {},
            type: FieldType.string,
            values: joinValues[i],
        });
    }
    for (let i = 0; i < allNames.length; i++) {
        const old = inputFields[allNames[i]];
        frame.fields.push({
            name: allNames[i],
            config: {},
            type: (_d = old.type) !== null && _d !== void 0 ? _d : FieldType.number,
            values: nameValues[i],
        });
    }
    return frame;
}
function getErrorFrame(text) {
    return {
        meta: {
            notices: [{ severity: 'error', text }],
        },
        fields: [{ name: 'Error', type: FieldType.string, config: {}, values: [text] }],
        length: 0,
    };
}
//# sourceMappingURL=joinByLabels.js.map