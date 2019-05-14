import * as tslib_1 from "tslib";
var ThresholdMapper = /** @class */ (function () {
    function ThresholdMapper() {
    }
    ThresholdMapper.alertToGraphThresholds = function (panel) {
        var e_1, _a;
        for (var i = 0; i < panel.alert.conditions.length; i++) {
            var condition = panel.alert.conditions[i];
            if (condition.type !== 'query') {
                continue;
            }
            var evaluator = condition.evaluator;
            var thresholds = (panel.thresholds = []);
            switch (evaluator.type) {
                case 'gt': {
                    var value = evaluator.params[0];
                    thresholds.push({ value: value, op: 'gt' });
                    break;
                }
                case 'lt': {
                    var value = evaluator.params[0];
                    thresholds.push({ value: value, op: 'lt' });
                    break;
                }
                case 'outside_range': {
                    var value1 = evaluator.params[0];
                    var value2 = evaluator.params[1];
                    if (value1 > value2) {
                        thresholds.push({ value: value1, op: 'gt' });
                        thresholds.push({ value: value2, op: 'lt' });
                    }
                    else {
                        thresholds.push({ value: value1, op: 'lt' });
                        thresholds.push({ value: value2, op: 'gt' });
                    }
                    break;
                }
                case 'within_range': {
                    var value1 = evaluator.params[0];
                    var value2 = evaluator.params[1];
                    if (value1 > value2) {
                        thresholds.push({ value: value1, op: 'lt' });
                        thresholds.push({ value: value2, op: 'gt' });
                    }
                    else {
                        thresholds.push({ value: value1, op: 'gt' });
                        thresholds.push({ value: value2, op: 'lt' });
                    }
                    break;
                }
            }
            break;
        }
        try {
            for (var _b = tslib_1.__values(panel.thresholds), _c = _b.next(); !_c.done; _c = _b.next()) {
                var t = _c.value;
                t.fill = true;
                t.line = true;
                t.colorMode = 'critical';
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
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