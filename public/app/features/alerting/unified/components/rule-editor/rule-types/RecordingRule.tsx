import React, { FC } from 'react';
import { RuleType, SharedProps } from './RuleType';
import { DisabledTooltip } from './DisabledTooltip';
import { RuleFormType } from '../../../types/rule-form';

const RecordingRuleType: FC<SharedProps> = ({ selected = false, disabled = false, onClick }) => {
  return (
    <DisabledTooltip visible={disabled}>
      <RuleType
        name="Prometheus-style recording rule"
        description={
          <p>
            Periodically compute new values.
            <br />
            Must be combined with an alert rule.
          </p>
        }
        image="/public/app/plugins/datasource/prometheus/img/prometheus_logo.svg"
        selected={selected}
        disabled={disabled}
        value={RuleFormType.cloudRecording}
        onClick={onClick}
      />
    </DisabledTooltip>
  );
};

export { RecordingRuleType };
