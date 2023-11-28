// @PERCONA
// This whole component is custom
import React from 'react';
import { useTheme2 } from '@grafana/ui';
import { RuleFormType } from '../../../types/rule-form';
import { RuleType } from './RuleType';
const TemplatedAlertRuleType = ({ selected = false, disabled, onClick }) => {
    const theme = useTheme2();
    return (React.createElement(RuleType, { name: "Percona templated alert", description: React.createElement("span", null,
            "Creates an alert based on a template.",
            React.createElement("br", null),
            "Simpler initial alert setup with more robust alerting options."), image: theme.isLight ? 'public/img/icons/mono/pmm-logo-light.svg' : 'public/img/icons/mono/pmm-logo.svg', selected: selected, disabled: disabled, value: RuleFormType.templated, onClick: onClick }));
};
export { TemplatedAlertRuleType };
//# sourceMappingURL=TemplatedAlert.js.map