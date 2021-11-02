import { __assign, __awaiter, __generator, __values } from "tslib";
import { FrameGeometrySourceMode, getFieldMatcher, FieldMatcherID, getFieldDisplayName, } from '@grafana/data';
import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { getGazetteer } from '../gazetteer/gazetteer';
import { decodeGeohash } from './geohash';
function getFieldFinder(matcher) {
    return function (frame) {
        var e_1, _a;
        try {
            for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
                var field = _c.value;
                if (matcher(field, frame, [])) {
                    return field;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return undefined;
    };
}
function matchLowerNames(names) {
    return function (frame) {
        var e_2, _a;
        try {
            for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
                var field = _c.value;
                if (names.has(field.name.toLowerCase())) {
                    return field;
                }
                var disp = getFieldDisplayName(field, frame);
                if (names.has(disp)) {
                    return field;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return undefined;
    };
}
var defaultMatchers = {
    mode: FrameGeometrySourceMode.Auto,
    geohash: matchLowerNames(new Set(['geohash'])),
    latitude: matchLowerNames(new Set(['latitude', 'lat'])),
    longitude: matchLowerNames(new Set(['longitude', 'lon', 'lng'])),
    h3: matchLowerNames(new Set(['h3'])),
    wkt: matchLowerNames(new Set(['wkt'])),
    lookup: matchLowerNames(new Set(['lookup'])),
};
export function getLocationMatchers(src) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var info, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    info = __assign(__assign({}, defaultMatchers), { mode: (_a = src === null || src === void 0 ? void 0 : src.mode) !== null && _a !== void 0 ? _a : FrameGeometrySourceMode.Auto });
                    _b = info.mode;
                    switch (_b) {
                        case FrameGeometrySourceMode.Geohash: return [3 /*break*/, 1];
                        case FrameGeometrySourceMode.Lookup: return [3 /*break*/, 2];
                        case FrameGeometrySourceMode.Coords: return [3 /*break*/, 4];
                    }
                    return [3 /*break*/, 5];
                case 1:
                    if (src === null || src === void 0 ? void 0 : src.geohash) {
                        info.geohash = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.geohash }));
                    }
                    return [3 /*break*/, 5];
                case 2:
                    if (src === null || src === void 0 ? void 0 : src.lookup) {
                        info.lookup = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.lookup }));
                    }
                    _c = info;
                    return [4 /*yield*/, getGazetteer(src === null || src === void 0 ? void 0 : src.gazetteer)];
                case 3:
                    _c.gazetteer = _d.sent();
                    return [3 /*break*/, 5];
                case 4:
                    if (src === null || src === void 0 ? void 0 : src.latitude) {
                        info.latitude = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.latitude }));
                    }
                    if (src === null || src === void 0 ? void 0 : src.longitude) {
                        info.longitude = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.longitude }));
                    }
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/, info];
            }
        });
    });
}
export function getLocationFields(frame, location) {
    var _a;
    var fields = {
        mode: (_a = location.mode) !== null && _a !== void 0 ? _a : FrameGeometrySourceMode.Auto,
    };
    // Find the best option
    if (fields.mode === FrameGeometrySourceMode.Auto) {
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
        fields.lookup = location.geohash(frame);
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
export function dataFrameToPoints(frame, location) {
    var info = {
        points: [],
    };
    if (!(frame === null || frame === void 0 ? void 0 : frame.length)) {
        return info;
    }
    var fields = getLocationFields(frame, location);
    switch (fields.mode) {
        case FrameGeometrySourceMode.Coords:
            if (fields.latitude && fields.longitude) {
                info.points = getPointsFromLonLat(fields.longitude, fields.latitude);
            }
            else {
                info.warning = 'Missing latitude/longitude fields';
            }
            break;
        case FrameGeometrySourceMode.Geohash:
            if (fields.geohash) {
                info.points = getPointsFromGeohash(fields.geohash);
            }
            else {
                info.warning = 'Missing geohash field';
            }
            break;
        case FrameGeometrySourceMode.Lookup:
            if (fields.lookup) {
                if (location.gazetteer) {
                    info.points = getPointsFromGazetteer(location.gazetteer, fields.lookup);
                }
                else {
                    info.warning = 'Gazetteer not found';
                }
            }
            else {
                info.warning = 'Missing lookup field';
            }
            break;
        case FrameGeometrySourceMode.Auto:
            info.warning = 'Unable to find location fields';
    }
    return info;
}
function getPointsFromLonLat(lon, lat) {
    var count = lat.values.length;
    var points = new Array(count);
    for (var i = 0; i < count; i++) {
        points[i] = new Point(fromLonLat([lon.values.get(i), lat.values.get(i)]));
    }
    return points;
}
function getPointsFromGeohash(field) {
    var count = field.values.length;
    var points = new Array(count);
    for (var i = 0; i < count; i++) {
        var coords = decodeGeohash(field.values.get(i));
        if (coords) {
            points[i] = new Point(fromLonLat(coords));
        }
    }
    return points;
}
function getPointsFromGazetteer(gaz, field) {
    var count = field.values.length;
    var points = new Array(count);
    for (var i = 0; i < count; i++) {
        var info = gaz.find(field.values.get(i));
        if (info === null || info === void 0 ? void 0 : info.coords) {
            points[i] = new Point(fromLonLat(info.coords));
        }
    }
    return points;
}
//# sourceMappingURL=location.js.map