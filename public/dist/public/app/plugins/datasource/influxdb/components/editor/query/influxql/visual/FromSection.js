import { __awaiter } from "tslib";
import React from 'react';
import { AccessoryButton } from '@grafana/experimental';
import { DEFAULT_POLICY } from '../../../../../types';
import { toSelectableValue } from '../utils/toSelectableValue';
import { Seg } from './Seg';
export const FromSection = ({ policy, measurement, onChange, getPolicyOptions, getMeasurementOptions, }) => {
    const handlePolicyLoadOptions = () => __awaiter(void 0, void 0, void 0, function* () {
        const allPolicies = yield getPolicyOptions();
        // if `default` does not exist in the list of policies, we add it
        const allPoliciesWithDefault = allPolicies.some((p) => p === DEFAULT_POLICY)
            ? allPolicies
            : [DEFAULT_POLICY, ...allPolicies];
        return allPoliciesWithDefault.map(toSelectableValue);
    });
    const handleMeasurementLoadOptions = (filter) => __awaiter(void 0, void 0, void 0, function* () {
        const allMeasurements = yield getMeasurementOptions(filter);
        return allMeasurements.map(toSelectableValue);
    });
    return (React.createElement(React.Fragment, null,
        React.createElement(Seg, { allowCustomValue: true, value: policy !== null && policy !== void 0 ? policy : 'using default policy', loadOptions: handlePolicyLoadOptions, onChange: (v) => {
                onChange(v.value, measurement);
            } }),
        React.createElement(Seg, { allowCustomValue: true, value: measurement !== null && measurement !== void 0 ? measurement : 'select measurement', loadOptions: handleMeasurementLoadOptions, filterByLoadOptions: true, onChange: (v) => {
                onChange(policy, v.value);
            } }),
        measurement && (React.createElement(AccessoryButton, { style: { marginRight: '4px' }, "aria-label": "remove", icon: "times", variant: "secondary", onClick: () => {
                onChange(policy, undefined);
            } }))));
};
//# sourceMappingURL=FromSection.js.map