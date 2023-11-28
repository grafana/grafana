import React from 'react';
import { RuleFormType } from '../../../types/rule-form';
import { DisabledTooltip } from './DisabledTooltip';
import { RuleType } from './RuleType';
const MimirFlavoredType = ({ selected = false, disabled = false, onClick }) => {
    return (React.createElement(DisabledTooltip, { visible: disabled },
        React.createElement(RuleType, { name: "Mimir or Loki alert", description: React.createElement("span", null,
                "Use a Mimir, Loki or Cortex datasource.",
                React.createElement("br", null),
                "Expressions are not supported."), image: "public/img/alerting/mimir_logo.svg", selected: selected, disabled: disabled, value: RuleFormType.cloudAlerting, onClick: onClick })));
};
export { MimirFlavoredType };
//# sourceMappingURL=MimirOrLokiAlert.js.map