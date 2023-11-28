import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
export function loadWorldmapPoints(path, data) {
    let count = 0;
    const values = new Map();
    for (const v of data) {
        const point = new Point(fromLonLat([v.longitude, v.latitude]));
        const info = {
            point: () => point,
            geometry: () => point,
        };
        if (v.name) {
            values.set(v.name, info);
            values.set(v.name.toUpperCase(), info);
        }
        if (v.key) {
            values.set(v.key, info);
            values.set(v.key.toUpperCase(), info);
        }
        if (v.keys) {
            for (const key of v.keys) {
                values.set(key, info);
                values.set(key.toUpperCase(), info);
            }
        }
        count++;
    }
    return {
        path,
        find: (k) => {
            let v = values.get(k);
            if (!v && typeof k === 'string') {
                v = values.get(k.toUpperCase());
            }
            return v;
        },
        count,
        examples: (count) => {
            const first = [];
            if (values.size < 1) {
                first.push('no values found');
            }
            else {
                for (const key of values.keys()) {
                    first.push(key);
                    if (first.length >= count) {
                        break;
                    }
                }
            }
            return first;
        },
    };
}
//# sourceMappingURL=worldmap.js.map