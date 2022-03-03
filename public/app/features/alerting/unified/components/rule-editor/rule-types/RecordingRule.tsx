import React, { FC } from 'react';
import { RuleType, SharedProps } from './RuleType';
import { RuleFormType } from '../../../types/rule-form';

const RecordingRuleType: FC<SharedProps> = ({ selected = false, disabled, onClick }) => {
  return (
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
  );
};

export default RecordingRuleType;
