import { FieldType } from '@grafana/data';
export function newLetterRandomizer() {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const charactersLength = upper.length;
    const history = new Map();
    return (v) => {
        const old = history.get(v);
        if (old != null) {
            return old;
        }
        const r = [...v]
            .map((c) => {
            if (c.toLowerCase() && c !== c.toUpperCase()) {
                return lower.charAt(Math.floor(Math.random() * charactersLength));
            }
            if (c.toUpperCase() && c !== c.toUpperCase()) {
                return upper.charAt(Math.floor(Math.random() * charactersLength));
            }
            return c;
        })
            .join('');
        history.set(v, r);
        return r;
    };
}
export function randomizeData(data, opts) {
    if (!(opts.labels || opts.names || opts.values)) {
        return data;
    }
    const keepNames = new Set(['time', 'value', 'exemplar', 'traceid', 'id', 'uid', 'uuid', '__name__', 'le', 'name']);
    const rand = newLetterRandomizer();
    return data.map((s) => {
        var _a;
        let { schema, data } = s;
        if (schema && data) {
            if (opts.labels) {
                for (const f of schema.fields) {
                    if (f.labels) {
                        const labels = {};
                        for (const [key, value] of Object.entries(f.labels)) {
                            labels[key] = rand(value);
                        }
                        f.labels = labels;
                    }
                }
            }
            if (opts.names) {
                for (const f of schema.fields) {
                    if (((_a = f.name) === null || _a === void 0 ? void 0 : _a.length) && !keepNames.has(f.name.toLowerCase())) {
                        f.name = rand(f.name);
                    }
                }
            }
            // Change values
            if (opts.values) {
                schema.fields.forEach((f, idx) => {
                    if (f.type === FieldType.string && data) {
                        const v = data.values[idx].map((v) => rand(String(v)));
                        data.values[idx] = v;
                    }
                });
            }
        }
        return { schema, data };
    });
}
//# sourceMappingURL=randomizer.js.map