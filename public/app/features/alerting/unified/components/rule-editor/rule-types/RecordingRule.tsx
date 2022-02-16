import React, { FC } from 'react';
import RuleType from './RuleType';

interface Props {
  selected?: boolean;
}

const RecordingRuleType: FC<Props> = ({ selected = false }) => {
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
    />
  );
};

export default RecordingRuleType;
