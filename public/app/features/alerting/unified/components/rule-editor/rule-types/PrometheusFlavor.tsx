import React, { FC } from 'react';
import { RuleType } from './RuleType';
import { RuleFormType } from '../../../types/rule-form';

interface Props {
  selected?: boolean;
  onClick: (value: RuleFormType) => void;
}

const PrometheusFlavoredType: FC<Props> = ({ selected = false, onClick }) => {
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
      onClick={() => onClick(RuleFormType.cloudAlerting)}
    />
  );
};

export default PrometheusFlavoredType;
