import React from 'react';
import { isAlertingRule } from '../../utils/rules';
import { DetailsField } from '../DetailsField';
import { AlertInstancesTable } from './AlertInstancesTable';
export function RuleDetailsMatchingInstances(props) {
    var _a;
    var promRule = props.promRule;
    if (!isAlertingRule(promRule) || !((_a = promRule.alerts) === null || _a === void 0 ? void 0 : _a.length)) {
        return null;
    }
    return (React.createElement(DetailsField, { label: "Matching instances", horizontal: true },
        React.createElement(AlertInstancesTable, { instances: promRule.alerts })));
}
//# sourceMappingURL=RuleDetailsMatchingInstances.js.map