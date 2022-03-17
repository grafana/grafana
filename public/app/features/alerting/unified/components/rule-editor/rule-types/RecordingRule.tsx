import React, { FC } from 'react';
import { RuleType, SharedProps } from './RuleType';
import { DisabledTooltip } from './DisabledTooltip';
import { RuleFormType } from '../../../types/rule-form';

const RecordingRuleType: FC<SharedProps> = ({ selected = false, disabled = false, onClick }) => {
  return (
    <DisabledTooltip visible={disabled}>
      <RuleType
        name="Cortex or Loki recording rule"
        description={
          <div>
            Precompute expressions.
            <br />
            Should be combined with an alert rule.
          </div>
        }
        image="/public/img/alerting/cortex_logo_recording.svg"
        selected={selected}
        disabled={disabled}
        value={RuleFormType.cloudRecording}
        onClick={onClick}
      />
    </DisabledTooltip>
  );
};

export { RecordingRuleType };
