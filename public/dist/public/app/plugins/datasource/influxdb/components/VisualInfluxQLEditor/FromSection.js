import { __awaiter, __generator, __read, __spreadArray } from "tslib";
import React from 'react';
import { Seg } from './Seg';
import { toSelectableValue } from './toSelectableValue';
var DEFAULT_POLICY = 'default';
export var FromSection = function (_a) {
    var policy = _a.policy, measurement = _a.measurement, onChange = _a.onChange, getPolicyOptions = _a.getPolicyOptions, getMeasurementOptions = _a.getMeasurementOptions;
    var handlePolicyLoadOptions = function () { return __awaiter(void 0, void 0, void 0, function () {
        var allPolicies, allPoliciesWithDefault;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getPolicyOptions()];
                case 1:
                    allPolicies = _a.sent();
                    allPoliciesWithDefault = allPolicies.some(function (p) { return p === 'default'; })
                        ? allPolicies
                        : __spreadArray([DEFAULT_POLICY], __read(allPolicies), false);
                    return [2 /*return*/, allPoliciesWithDefault.map(toSelectableValue)];
            }
        });
    }); };
    var handleMeasurementLoadOptions = function (filter) { return __awaiter(void 0, void 0, void 0, function () {
        var allMeasurements;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getMeasurementOptions(filter)];
                case 1:
                    allMeasurements = _a.sent();
                    return [2 /*return*/, allMeasurements.map(toSelectableValue)];
            }
        });
    }); };
    return (React.createElement(React.Fragment, null,
        React.createElement(Seg, { allowCustomValue: true, value: policy !== null && policy !== void 0 ? policy : 'using default policy', loadOptions: handlePolicyLoadOptions, onChange: function (v) {
                onChange(v.value, measurement);
            } }),
        React.createElement(Seg, { allowCustomValue: true, value: measurement !== null && measurement !== void 0 ? measurement : 'select measurement', loadOptions: handleMeasurementLoadOptions, filterByLoadOptions: true, onChange: function (v) {
                onChange(policy, v.value);
            } })));
};
//# sourceMappingURL=FromSection.js.map