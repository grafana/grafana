import React, { FC } from 'react';

import { RuleFormType } from '../../../types/rule-form';

import { DisabledTooltip } from './DisabledTooltip';
import { RuleType, SharedProps } from './RuleType';

const RecordingRuleType: FC<SharedProps> = ({ selected = false, disabled = false, onClick }) => {
  return (
    <DisabledTooltip visible={disabled}>
      <RuleType
        name="Mimir or Loki recording rule"
        description={
          <span>
            Precompute expressions.
            <br />
            Should be combined with an alert rule.
          </span>
        }
        image="public/img/alerting/mimir_logo_recording.svg"
        selected={selected}
        disabled={disabled}
        value={RuleFormType.cloudRecording}
        onClick={onClick}
      />
    </DisabledTooltip>
  );
};

export { RecordingRuleType };
