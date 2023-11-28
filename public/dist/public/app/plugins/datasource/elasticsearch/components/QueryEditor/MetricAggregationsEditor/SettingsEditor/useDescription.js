import { extendedStats } from '../../../../queryDef';
const hasValue = (value) => (object) => object.value === value;
// FIXME: All the defaults and validations down here should be defined somewhere else
// as they are also the defaults that are gonna be applied to the query.
// In the previous version, the same method was taking care of describing the settings and setting defaults.
export const useDescription = (metric) => {
    var _a, _b, _c, _d, _e, _f;
    switch (metric.type) {
        case 'cardinality': {
            const precisionThreshold = ((_a = metric.settings) === null || _a === void 0 ? void 0 : _a.precision_threshold) || '';
            return `Precision threshold: ${precisionThreshold}`;
        }
        case 'percentiles':
            if (((_b = metric.settings) === null || _b === void 0 ? void 0 : _b.percents) && ((_d = (_c = metric.settings) === null || _c === void 0 ? void 0 : _c.percents) === null || _d === void 0 ? void 0 : _d.length) >= 1) {
                return `Values: ${(_e = metric.settings) === null || _e === void 0 ? void 0 : _e.percents}`;
            }
            return 'Percents: Default';
        case 'extended_stats': {
            const selectedStats = Object.entries(metric.meta || {})
                .map(([key, value]) => { var _a; return value && ((_a = extendedStats.find(hasValue(key))) === null || _a === void 0 ? void 0 : _a.label); })
                .filter(Boolean);
            return `Stats: ${selectedStats.length > 0 ? selectedStats.join(', ') : 'None selected'}`;
        }
        case 'raw_document':
        case 'raw_data': {
            const size = ((_f = metric.settings) === null || _f === void 0 ? void 0 : _f.size) || 500;
            return `Size: ${size}`;
        }
        default:
            return 'Options';
    }
};
//# sourceMappingURL=useDescription.js.map