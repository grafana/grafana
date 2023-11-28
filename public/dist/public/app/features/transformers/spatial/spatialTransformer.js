import { __awaiter } from "tslib";
import { mergeMap, from } from 'rxjs';
import { DataTransformerID, FieldType } from '@grafana/data';
import { createGeometryCollection, createLineBetween } from 'app/features/geo/format/utils';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';
import { SpatialOperation, SpatialAction } from './models.gen';
import { doGeomeryCalculation, toLineString } from './utils';
export const spatialTransformer = {
    id: DataTransformerID.spatial,
    name: 'Spatial operations',
    description: 'Apply spatial operations to query results.',
    defaultOptions: {},
    operator: (options) => (source) => source.pipe(mergeMap((data) => from(doSetGeometry(data, options)))),
};
export function isLineBuilderOption(options) {
    var _a;
    return options.action === SpatialAction.Modify && ((_a = options.modify) === null || _a === void 0 ? void 0 : _a.op) === SpatialOperation.LineBuilder;
}
function doSetGeometry(frames, options) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const location = yield getLocationMatchers(options.source);
        if (isLineBuilderOption(options)) {
            const targetLocation = yield getLocationMatchers((_a = options.modify) === null || _a === void 0 ? void 0 : _a.target);
            return frames.map((frame) => {
                const src = getGeometryField(frame, location);
                const target = getGeometryField(frame, targetLocation);
                if (src.field && target.field) {
                    const fields = [...frame.fields];
                    const line = createLineBetween(src.field, target.field);
                    const first = fields[0];
                    if (first.type === FieldType.geo && first !== src.field && first !== target.field) {
                        fields[0] = createGeometryCollection(first, line); //
                    }
                    else {
                        fields.unshift(line);
                    }
                    return Object.assign(Object.assign({}, frame), { fields });
                }
                return frame;
            });
        }
        return frames.map((frame) => {
            var _a, _b;
            let info = getGeometryField(frame, location);
            if (info.field) {
                if (options.action === SpatialAction.Modify) {
                    switch ((_a = options.modify) === null || _a === void 0 ? void 0 : _a.op) {
                        // SOON: extent, convex hull, etc
                        case SpatialOperation.AsLine:
                            let name = info.field.name;
                            if (!name || name === 'Point') {
                                name = 'Line';
                            }
                            return Object.assign(Object.assign({}, frame), { length: 1, fields: [
                                    Object.assign(Object.assign({}, info.field), { name, type: FieldType.geo, values: [toLineString(info.field)] }),
                                ] });
                    }
                    return frame;
                }
                const fields = info.derived ? [info.field, ...frame.fields] : frame.fields.slice(0);
                if (options.action === SpatialAction.Calculate) {
                    fields.push(doGeomeryCalculation(info.field, (_b = options.calculate) !== null && _b !== void 0 ? _b : {}));
                    info.derived = true;
                }
                if (info.derived) {
                    return Object.assign(Object.assign({}, frame), { fields });
                }
            }
            return frame;
        });
    });
}
//# sourceMappingURL=spatialTransformer.js.map