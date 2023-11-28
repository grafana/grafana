import { __awaiter } from "tslib";
import { getCenter } from 'ol/extent';
import { Point } from 'ol/geom';
import { FieldType, toDataFrame } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { frameFromGeoJSON } from '../format/geojson';
import { pointFieldFromLonLat, pointFieldFromGeohash } from '../format/utils';
import { loadWorldmapPoints } from './worldmap';
// Without knowing the datatype pick a good lookup function
export function loadGazetteer(path, data) {
    // try loading geojson
    let frame = undefined;
    if (Array.isArray(data)) {
        const first = data[0];
        // Check for legacy worldmap syntax
        if (first.latitude && first.longitude && (first.key || first.keys)) {
            return loadWorldmapPoints(path, data);
        }
    }
    else {
        if (Array.isArray(data === null || data === void 0 ? void 0 : data.features) && (data === null || data === void 0 ? void 0 : data.type) === 'FeatureCollection') {
            frame = frameFromGeoJSON(data);
        }
    }
    if (!frame) {
        try {
            frame = toDataFrame(data);
        }
        catch (ex) {
            return {
                path,
                error: `${ex}`,
                find: (k) => undefined,
                examples: (v) => [],
            };
        }
    }
    return frameAsGazetter(frame, { path });
}
export function frameAsGazetter(frame, opts) {
    var _a;
    const keys = [];
    let geo = undefined;
    let lat = undefined;
    let lng = undefined;
    let geohash = undefined;
    let firstString = undefined;
    for (const f of frame.fields) {
        if (f.type === FieldType.geo) {
            geo = f;
        }
        if (!firstString && f.type === FieldType.string) {
            firstString = f;
        }
        if (f.name) {
            if (opts.keys && opts.keys.includes(f.name)) {
                keys.push(f);
            }
            const name = f.name.toUpperCase();
            switch (name) {
                case 'LAT':
                case 'LATITUTE':
                    lat = f;
                    break;
                case 'LON':
                case 'LNG':
                case 'LONG':
                case 'LONGITUE':
                    lng = f;
                    break;
                case 'GEOHASH':
                    geohash = f;
                    break;
                case 'ID':
                case 'UID':
                case 'KEY':
                case 'CODE':
                    if (!opts.keys) {
                        keys.push(f);
                    }
                    break;
                default: {
                    if (!opts.keys) {
                        if (name.endsWith('_ID') || name.endsWith('_CODE')) {
                            keys.push(f);
                        }
                    }
                }
            }
        }
    }
    // Use the first string field
    if (!keys.length && firstString) {
        keys.push(firstString);
    }
    let isPoint = false;
    // Create a geo field from lat+lng
    if (!geo) {
        if (geohash) {
            geo = pointFieldFromGeohash(geohash);
            isPoint = true;
        }
        else if (lat && lng) {
            geo = pointFieldFromLonLat(lng, lat);
            isPoint = true;
        }
    }
    else {
        isPoint = ((_a = geo.values[0]) === null || _a === void 0 ? void 0 : _a.getType()) === 'Point';
    }
    const lookup = new Map();
    keys.forEach((f) => {
        f.values.forEach((k, idx) => {
            const str = `${k}`;
            lookup.set(str.toUpperCase(), idx);
            lookup.set(str, idx);
        });
    });
    return {
        path: opts.path,
        find: (k) => {
            const index = lookup.get(k);
            if (index != null) {
                const g = geo === null || geo === void 0 ? void 0 : geo.values[index];
                return {
                    frame,
                    index,
                    point: () => {
                        if (!g || isPoint) {
                            return g;
                        }
                        return new Point(getCenter(g.getExtent()));
                    },
                    geometry: () => g,
                };
            }
            return undefined;
        },
        examples: (v) => {
            const ex = [];
            for (let k of lookup.keys()) {
                ex.push(k);
                if (ex.length > v) {
                    break;
                }
            }
            return ex;
        },
        frame: () => frame,
        count: frame.length,
    };
}
const registry = {};
export const COUNTRIES_GAZETTEER_PATH = 'public/gazetteer/countries.json';
/**
 * Given a path to a file return a cached lookup function
 */
export function getGazetteer(path) {
    return __awaiter(this, void 0, void 0, function* () {
        // When not specified, use the default path
        if (!path) {
            path = COUNTRIES_GAZETTEER_PATH;
        }
        let lookup = registry[path];
        if (!lookup) {
            try {
                // block the async function
                const data = yield getBackendSrv().get(path);
                lookup = loadGazetteer(path, data);
            }
            catch (err) {
                console.warn('Error loading placename lookup', path, err);
                lookup = {
                    path,
                    error: 'Error loading URL',
                    find: (k) => undefined,
                    examples: (v) => [],
                };
            }
            registry[path] = lookup;
        }
        return lookup;
    });
}
//# sourceMappingURL=gazetteer.js.map