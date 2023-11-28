import React from 'react';
import { RuleFormType } from '../../../types/rule-form';
import { RuleType } from './RuleType';
const GrafanaManagedRuleType = ({ selected = false, disabled, onClick }) => {
    return (React.createElement(RuleType, { name: "Grafana managed alert", description: React.createElement("span", null,
            "Supports multiple data sources of any kind.",
            React.createElement("br", null),
            "Transform data with expressions."), image: "public/img/grafana_icon.svg", selected: selected, disabled: disabled, value: RuleFormType.grafana, onClick: onClick }));
};
export { GrafanaManagedRuleType };
//# sourceMappingURL=GrafanaManagedAlert.js.map