import { __values } from "tslib";
import { config } from 'app/core/config';
export var hiddenReducerTypes = ['percent_diff', 'percent_diff_abs'];
var ThresholdMapper = /** @class */ (function () {
    function ThresholdMapper() {
    }
    ThresholdMapper.alertToGraphThresholds = function (panel) {
        var e_1, _a;
        var _b;
        if (!panel.alert || config.unifiedAlertingEnabled) {
            return false; // no update when no alerts
        }
        for (var i = 0; i < panel.alert.conditions.length; i++) {
            var condition = panel.alert.conditions[i];
            if (condition.type !== 'query') {
                continue;
            }
            var evaluator = condition.evaluator;
            var thresholds = (panel.thresholds = []);
            var visible = hiddenReducerTypes.indexOf((_b = condition.reducer) === null || _b === void 0 ? void 0 : _b.type) === -1;
            switch (evaluator.type) {
                case 'gt': {
                    var value = evaluator.params[0];
                    thresholds.push({ value: value, op: 'gt', visible: visible });
                    break;
                }
                case 'lt': {
                    var value = evaluator.params[0];
                    thresholds.push({ value: value, op: 'lt', visible: visible });
                    break;
                }
                case 'outside_range': {
                    var value1 = evaluator.params[0];
                    var value2 = evaluator.params[1];
                    if (value1 > value2) {
                        thresholds.push({ value: value1, op: 'gt', visible: visible });
                        thresholds.push({ value: value2, op: 'lt', visible: visible });
                    }
                    else {
                        thresholds.push({ value: value1, op: 'lt', visible: visible });
                        thresholds.push({ value: value2, op: 'gt', visible: visible });
                    }
                    break;
                }
                case 'within_range': {
                    var value1 = evaluator.params[0];
                    var value2 = evaluator.params[1];
                    if (value1 > value2) {
                        thresholds.push({ value: value1, op: 'lt', visible: visible });
                        thresholds.push({ value: value2, op: 'gt', visible: visible });
                    }
                    else {
                        thresholds.push({ value: value1, op: 'gt', visible: visible });
                        thresholds.push({ value: value2, op: 'lt', visible: visible });
                    }
                    break;
                }
            }
            break;
        }
        try {
            for (var _c = __values(panel.thresholds), _d = _c.next(); !_d.done; _d = _c.next()) {
                var t = _d.value;
                t.fill = panel.options.alertThreshold;
                t.line = panel.options.alertThreshold;
                t.colorMode = 'critical';
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        var updated = true;
        return updated;
    };
    return ThresholdMapper;
}());
export { ThresholdMapper };
//# sourceMappingURL=ThresholdMapper.js.map