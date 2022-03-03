import React, { FC } from 'react';
import { RuleType, SharedProps } from './RuleType';
import { RuleFormType } from '../../../types/rule-form';

interface Props extends SharedProps {
  onClick: (value: RuleFormType) => void;
}

const PrometheusFlavoredType: FC<Props> = ({ selected = false, disabled, onClick }) => {
  return (
    <RuleType
      name="Prometheus-style alert"
      description={
        <p>
          Use Prometheus-compatible datasource.
          <br />
          Expressions not supported.
        </p>
      }
      image="/public/app/plugins/datasource/prometheus/img/prometheus_logo.svg"
      selected={selected}
      disabled={disabled}
      value={RuleFormType.cloudAlerting}
      onClick={onClick}
    />
  );
};

export default PrometheusFlavoredType;
