import { getCenter } from 'ol/extent';
import { LineString, Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { getArea, getLength } from 'ol/sphere';
import { FieldType } from '@grafana/data';
import { SpatialCalculation } from './models.gen';
/** Will return a field with a single row */
export function toLineString(field) {
    const coords = [];
    for (const geo of field.values) {
        if (geo) {
            coords.push(getCenterPoint(geo));
        }
    }
    return new LineString(coords);
}
/** Will return a field with a single row */
export function calculateBearings(values) {
    const bearing = new Array(values.length);
    if (values.length > 1) {
        let prev = getCenterPointWGS84(values[0]);
        for (let i = 1; i < values.length; i++) {
            let next = getCenterPointWGS84(values[i]);
            if (prev && next) {
                let degrees = (Math.atan2(next[0] - prev[0], next[1] - prev[1]) * 180) / Math.PI;
                if (degrees < 0.0) {
                    degrees += 360.0;
                }
                bearing[i - 1] = bearing[i] = degrees;
            }
        }
    }
    else {
        bearing.fill(0);
    }
    return bearing;
}
export function getCenterPoint(geo) {
    if (geo instanceof Point) {
        return geo.getCoordinates();
    }
    return getCenter(geo.getExtent());
}
export function getCenterPointWGS84(geo) {
    if (!geo) {
        return undefined;
    }
    return toLonLat(getCenterPoint(geo));
}
/** Will return a new field with calculated values */
export function doGeomeryCalculation(field, options) {
    var _a, _b;
    const values = field.values;
    const buffer = new Array(field.values.length);
    const op = (_a = options.calc) !== null && _a !== void 0 ? _a : SpatialCalculation.Heading;
    const name = (_b = options.field) !== null && _b !== void 0 ? _b : op;
    switch (op) {
        case SpatialCalculation.Area: {
            for (let i = 0; i < values.length; i++) {
                const geo = values[i];
                if (geo) {
                    buffer[i] = getArea(geo);
                }
            }
            return {
                name,
                type: FieldType.number,
                config: {
                    unit: 'areaM2',
                },
                values: buffer,
            };
        }
        case SpatialCalculation.Distance: {
            for (let i = 0; i < values.length; i++) {
                const geo = values[i];
                if (geo) {
                    buffer[i] = getLength(geo);
                }
            }
            return {
                name,
                type: FieldType.number,
                config: {
                    unit: 'lengthm',
                },
                values: buffer,
            };
        }
        // Use heading as default
        case SpatialCalculation.Heading:
        default: {
            return {
                name,
                type: FieldType.number,
                config: {
                    unit: 'degree',
                },
                values: calculateBearings(values),
            };
        }
    }
}
//# sourceMappingURL=utils.js.map