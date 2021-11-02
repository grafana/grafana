import { __assign } from "tslib";
import { getFieldDisplayName } from './fieldState';
import { formatLabels } from '../utils/labels';
/**
 * This object is created often, and only used when tmplates exist.  Using a proxy lets us delay
 * calculations of the more complex structures (label names) until they are actually used
 */
export function getTemplateProxyForField(field, frame, frames) {
    return new Proxy({}, // This object shows up in test snapshots
    {
        get: function (obj, key, reciever) {
            if (key === 'name') {
                return field.name;
            }
            if (key === 'displayName') {
                return getFieldDisplayName(field, frame, frames);
            }
            if (key === 'labels' || key === 'formattedLabels') {
                // formattedLabels deprecated
                if (!field.labels) {
                    return '';
                }
                return __assign(__assign({}, field.labels), { __values: Object.values(field.labels).sort().join(', '), toString: function () {
                        return formatLabels(field.labels, '', true);
                    } });
            }
            return undefined; // (field as any)[key]; // any property?
        },
    });
}
//# sourceMappingURL=templateProxies.js.map