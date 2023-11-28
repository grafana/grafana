import { __awaiter } from "tslib";
import { getFieldMatcher, FieldMatcherID, getFieldDisplayName, FieldType, } from '@grafana/data';
import { FrameGeometrySourceMode } from '@grafana/schema';
import { getGeoFieldFromGazetteer, pointFieldFromGeohash, pointFieldFromLonLat } from '../format/utils';
import { getGazetteer } from '../gazetteer/gazetteer';
function getFieldFinder(matcher) {
    return (frame) => {
        for (const field of frame.fields) {
            if (matcher(field, frame, [])) {
                return field;
            }
        }
        return undefined;
    };
}
function matchLowerNames(names) {
    return (frame) => {
        for (const field of frame.fields) {
            if (names.has(field.name.toLowerCase())) {
                return field;
            }
            const disp = getFieldDisplayName(field, frame);
            if (names.has(disp)) {
                return field;
            }
        }
        return undefined;
    };
}
const defaultMatchers = {
    mode: FrameGeometrySourceMode.Auto,
    geohash: matchLowerNames(new Set(['geohash'])),
    latitude: matchLowerNames(new Set(['latitude', 'lat'])),
    longitude: matchLowerNames(new Set(['longitude', 'lon', 'lng'])),
    h3: matchLowerNames(new Set(['h3'])),
    wkt: matchLowerNames(new Set(['wkt'])),
    lookup: matchLowerNames(new Set(['lookup'])),
    geo: (frame) => frame.fields.find((f) => f.type === FieldType.geo),
};
export function getLocationMatchers(src) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const info = Object.assign(Object.assign({}, defaultMatchers), { mode: (_a = src === null || src === void 0 ? void 0 : src.mode) !== null && _a !== void 0 ? _a : FrameGeometrySourceMode.Auto });
        info.gazetteer = yield getGazetteer(src === null || src === void 0 ? void 0 : src.gazetteer); // Always have gazetteer selected (or default) for smooth transition
        switch (info.mode) {
            case FrameGeometrySourceMode.Geohash:
                if (src === null || src === void 0 ? void 0 : src.geohash) {
                    info.geohash = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.geohash }));
                }
                else {
                    info.geohash = () => undefined; // In manual mode, don't automatically find field
                }
                break;
            case FrameGeometrySourceMode.Lookup:
                const m = ((_b = src === null || src === void 0 ? void 0 : src.lookup) === null || _b === void 0 ? void 0 : _b.length)
                    ? getFieldMatcher({ id: FieldMatcherID.byName, options: src.lookup })
                    : getFieldMatcher({ id: FieldMatcherID.byType, options: FieldType.string });
                info.lookup = getFieldFinder(m);
                break;
            case FrameGeometrySourceMode.Coords:
                if (src === null || src === void 0 ? void 0 : src.latitude) {
                    info.latitude = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.latitude }));
                }
                else {
                    info.latitude = () => undefined; // In manual mode, don't automatically find field
                }
                if (src === null || src === void 0 ? void 0 : src.longitude) {
                    info.longitude = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.longitude }));
                }
                else {
                    info.longitude = () => undefined; // In manual mode, don't automatically find field
                }
                break;
        }
        return info;
    });
}
export function getLocationFields(frame, location) {
    var _a;
    const fields = {
        mode: (_a = location.mode) !== null && _a !== void 0 ? _a : FrameGeometrySourceMode.Auto,
    };
    // Find the best option
    if (fields.mode === FrameGeometrySourceMode.Auto) {
        fields.geo = location.geo(frame);
        if (fields.geo) {
            return fields;
        }
        fields.latitude = location.latitude(frame);
        fields.longitude = location.longitude(frame);
        if (fields.latitude && fields.longitude) {
            fields.mode = FrameGeometrySourceMode.Coords;
            return fields;
        }
        fields.geohash = location.geohash(frame);
        if (fields.geohash) {
            fields.mode = FrameGeometrySourceMode.Geohash;
            return fields;
        }
        fields.lookup = location.lookup(frame);
        if (fields.lookup) {
            fields.mode = FrameGeometrySourceMode.Lookup;
            return fields;
        }
    }
    switch (fields.mode) {
        case FrameGeometrySourceMode.Coords:
            fields.latitude = location.latitude(frame);
            fields.longitude = location.longitude(frame);
            break;
        case FrameGeometrySourceMode.Geohash:
            fields.geohash = location.geohash(frame);
            break;
        case FrameGeometrySourceMode.Lookup:
            fields.lookup = location.lookup(frame);
            break;
    }
    return fields;
}
export function getGeometryField(frame, location) {
    const fields = getLocationFields(frame, location);
    switch (fields.mode) {
        case FrameGeometrySourceMode.Auto:
            if (fields.geo) {
                return {
                    field: fields.geo,
                };
            }
            return {
                warning: 'Unable to find location fields',
            };
        case FrameGeometrySourceMode.Coords:
            if (fields.latitude && fields.longitude) {
                return {
                    field: pointFieldFromLonLat(fields.longitude, fields.latitude),
                    derived: true,
                    description: `${fields.mode}: ${fields.latitude.name}, ${fields.longitude.name}`,
                };
            }
            return {
                warning: 'Select latitude/longitude fields',
            };
        case FrameGeometrySourceMode.Geohash:
            if (fields.geohash) {
                return {
                    field: pointFieldFromGeohash(fields.geohash),
                    derived: true,
                    description: `${fields.mode}`,
                };
            }
            return {
                warning: 'Select geohash field',
            };
        case FrameGeometrySourceMode.Lookup:
            if (fields.lookup) {
                if (location.gazetteer) {
                    return {
                        field: getGeoFieldFromGazetteer(location.gazetteer, fields.lookup),
                        derived: true,
                        description: `${fields.mode}: ${location.gazetteer.path}`, // TODO get better name for this
                    };
                }
                return {
                    warning: 'Gazetteer not found',
                };
            }
            return {
                warning: 'Select lookup field',
            };
    }
    return { warning: 'unable to find geometry' };
}
//# sourceMappingURL=location.js.map