import GeoJSON from 'ol/format/GeoJSON';
import { FieldType, getFieldTypeFromValue } from '@grafana/data';
// http://geojson.xyz/
export function frameFromGeoJSON(body) {
    const data = new GeoJSON().readFeatures(body, { featureProjection: 'EPSG:3857' });
    const length = data.length;
    const geo = new Array(length).fill(null);
    const fieldOrder = [];
    const lookup = new Map();
    const getField = (name) => {
        let f = lookup.get(name);
        if (!f) {
            f = {
                types: new Set(),
                values: new Array(length).fill(null),
                count: 0,
            };
            fieldOrder.push(name);
            lookup.set(name, f);
        }
        return f;
    };
    const getBestName = (...names) => {
        for (const k of names) {
            if (!lookup.has(k)) {
                return k;
            }
        }
        return '___' + names[0];
    };
    const idfield = {
        types: new Set(),
        values: new Array(length).fill(null),
        count: 0,
    };
    for (let i = 0; i < length; i++) {
        const feature = data[i];
        geo[i] = feature.getGeometry();
        const id = feature.getId();
        if (id != null) {
            idfield.values[i] = id;
            idfield.types.add(getFieldTypeFromValue(id));
            idfield.count++;
        }
        for (const key of feature.getKeys()) {
            const val = feature.get(key);
            if (val === geo[i] || val == null) {
                continue;
            }
            const field = getField(key);
            field.values[i] = val;
            field.types.add(getFieldTypeFromValue(val));
            field.count++;
        }
    }
    const fields = [];
    if (idfield.count > 0) {
        const type = ensureSingleType(idfield);
        fields.push({
            name: getBestName('id', '_id', '__id'),
            type,
            values: idfield.values,
            config: {},
        });
    }
    // Add a geometry field
    fields.push({
        name: getBestName('geo', 'geometry'),
        type: FieldType.geo,
        values: geo,
        config: {},
    });
    for (const name of fieldOrder) {
        const info = lookup.get(name);
        if (!info) {
            continue;
        }
        const type = ensureSingleType(info);
        fields.push({
            name,
            type,
            values: info.values,
            config: {},
        });
    }
    // Simple frame
    return {
        fields,
        length,
    };
}
function ensureSingleType(info) {
    if (info.count < 1) {
        return FieldType.other;
    }
    if (info.types.size > 1) {
        info.values = info.values.map((v) => {
            if (v != null) {
                return `${v}`;
            }
            return v;
        });
        return FieldType.string;
    }
    return info.types.values().next().value;
}
//# sourceMappingURL=geojson.js.map