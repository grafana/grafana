import { __assign } from "tslib";
import { DataTransformerID } from './ids';
import { map } from 'rxjs/operators';
import { getFieldDisplayName } from '../../field/fieldState';
/**
 * Replaces the displayName of a field by applying a regular expression
 * to match the name and a pattern for the replacement.
 *
 * @public
 */
export var renameByRegexTransformer = {
    id: DataTransformerID.renameByRegex,
    name: 'Rename fields by regex',
    description: 'Rename fields based on regular expression by users.',
    defaultOptions: {
        regex: '(.*)',
        renamePattern: '$1',
    },
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) {
        return source.pipe(map(function (data) {
            if (!Array.isArray(data) || data.length === 0) {
                return data;
            }
            return data.map(renameFieldsByRegex(options));
        }));
    }; },
};
var renameFieldsByRegex = function (options) { return function (frame) {
    var regex = new RegExp(options.regex);
    var fields = frame.fields.map(function (field) {
        var displayName = getFieldDisplayName(field, frame);
        if (!regex.test(displayName)) {
            return field;
        }
        var newDisplayName = displayName.replace(regex, options.renamePattern);
        return __assign(__assign({}, field), { config: __assign(__assign({}, field.config), { displayName: newDisplayName }), state: __assign(__assign({}, field.state), { displayName: newDisplayName }) });
    });
    return __assign(__assign({}, frame), { fields: fields });
}; };
//# sourceMappingURL=renameByRegex.js.map