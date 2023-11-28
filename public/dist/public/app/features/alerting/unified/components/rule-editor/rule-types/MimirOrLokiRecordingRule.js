import React from 'react';
import { RuleFormType } from '../../../types/rule-form';
import { DisabledTooltip } from './DisabledTooltip';
import { RuleType } from './RuleType';
const RecordingRuleType = ({ selected = false, disabled = false, onClick }) => {
    return (React.createElement(DisabledTooltip, { visible: disabled },
        React.createElement(RuleType, { name: "Mimir or Loki recording rule", description: React.createElement("span", null,
                "Precompute expressions.",
                React.createElement("br", null),
                "Should be combined with an alert rule."), image: "public/img/alerting/mimir_logo_recording.svg", selected: selected, disabled: disabled, value: RuleFormType.cloudRecording, onClick: onClick })));
};
export { RecordingRuleType };
//# sourceMappingURL=MimirOrLokiRecordingRule.js.map