import { __values } from "tslib";
import { FALLBACK_COLOR, ThresholdsMode } from '../types';
export var fallBackTreshold = { value: 0, color: FALLBACK_COLOR };
export function getActiveThreshold(value, thresholds) {
    var e_1, _a;
    if (!thresholds || thresholds.length === 0) {
        return fallBackTreshold;
    }
    var active = thresholds[0];
    try {
        for (var thresholds_1 = __values(thresholds), thresholds_1_1 = thresholds_1.next(); !thresholds_1_1.done; thresholds_1_1 = thresholds_1.next()) {
            var threshold = thresholds_1_1.value;
            if (value >= threshold.value) {
                active = threshold;
            }
            else {
                break;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (thresholds_1_1 && !thresholds_1_1.done && (_a = thresholds_1.return)) _a.call(thresholds_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return active;
}
export function getActiveThresholdForValue(field, value, percent) {
    var thresholds = field.config.thresholds;
    if ((thresholds === null || thresholds === void 0 ? void 0 : thresholds.mode) === ThresholdsMode.Percentage) {
        return getActiveThreshold(percent * 100, thresholds === null || thresholds === void 0 ? void 0 : thresholds.steps);
    }
    return getActiveThreshold(value, thresholds === null || thresholds === void 0 ? void 0 : thresholds.steps);
}
/**
 * Sorts the thresholds
 */
export function sortThresholds(thresholds) {
    return thresholds.sort(function (t1, t2) { return t1.value - t2.value; });
}
//# sourceMappingURL=thresholds.js.map