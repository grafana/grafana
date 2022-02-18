import React, { FC } from 'react';
import { RuleType } from './RuleType';
import { RuleFormType } from '../../../types/rule-form';

interface Props {
  selected?: boolean;
  onClick: (value: RuleFormType) => void;
}

const RecordingRuleType: FC<Props> = ({ selected = false, onClick }) => {
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
      onClick={() => onClick(RuleFormType.cloudRecording)}
    />
  );
};

export default RecordingRuleType;
