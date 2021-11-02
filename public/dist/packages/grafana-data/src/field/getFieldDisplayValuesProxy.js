import { toNumber } from 'lodash';
import { formattedValueToString } from '../valueFormats';
import { getDisplayProcessor } from './displayProcessor';
/**
 * Creates a proxy object that allows accessing fields on dataFrame through various means and then returns it's
 * display value. This is mainly useful for example in data links interpolation where you can easily create a scoped
 * variable that will allow you to access dataFrame data with ${__data.fields.fieldName}.
 * Allows accessing fields by name, index, displayName or 'name' label
 *
 * @param options
 * @internal
 */
export function getFieldDisplayValuesProxy(options) {
    return new Proxy({}, {
        get: function (obj, key) {
            var _a;
            // 1. Match the name
            var field = options.frame.fields.find(function (f) { return key === f.name; });
            if (!field) {
                // 2. Match the array index
                var k = toNumber(key);
                field = options.frame.fields[k];
            }
            if (!field) {
                // 3. Match the config displayName
                field = options.frame.fields.find(function (f) { return key === f.config.displayName; });
            }
            if (!field) {
                // 4. Match the name label
                field = options.frame.fields.find(function (f) {
                    if (f.labels) {
                        return key === f.labels.name;
                    }
                    return false;
                });
            }
            if (!field) {
                return undefined;
            }
            // TODO: we could supply the field here for the getDisplayProcessor fallback but we would also need theme which
            //  we do not have access to here
            var displayProcessor = (_a = field.display) !== null && _a !== void 0 ? _a : getDisplayProcessor();
            var raw = field.values.get(options.rowIndex);
            var disp = displayProcessor(raw);
            disp.toString = function () { return formattedValueToString(disp); };
            return disp;
        },
    });
}
//# sourceMappingURL=getFieldDisplayValuesProxy.js.map