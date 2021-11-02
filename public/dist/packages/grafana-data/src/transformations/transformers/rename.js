import { __assign } from "tslib";
import { DataTransformerID } from './ids';
import { getFieldDisplayName } from '../../field/fieldState';
import { map } from 'rxjs/operators';
export var renameFieldsTransformer = {
    id: DataTransformerID.rename,
    name: 'Rename fields by name',
    description: 'Rename fields based on configuration given by user',
    defaultOptions: {
        renameByName: {},
    },
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) {
        return source.pipe(map(function (data) {
            var renamer = createRenamer(options.renameByName);
            if (!Array.isArray(data) || data.length === 0) {
                return data;
            }
            return data.map(function (frame) { return (__assign(__assign({}, frame), { fields: renamer(frame) })); });
        }));
    }; },
};
var createRenamer = function (renameByName) { return function (frame) {
    if (!renameByName || Object.keys(renameByName).length === 0) {
        return frame.fields;
    }
    return frame.fields.map(function (field) {
        var displayName = getFieldDisplayName(field, frame);
        var renameTo = renameByName[displayName];
        if (typeof renameTo !== 'string' || renameTo.length === 0) {
            return field;
        }
        return __assign(__assign({}, field), { config: __assign(__assign({}, field.config), { displayName: renameTo }), state: __assign(__assign({}, field.state), { displayName: renameTo }) });
    });
}; };
//# sourceMappingURL=rename.js.map