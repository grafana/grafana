import React, { FC } from 'react';
import RuleType from './RuleType';

interface Props {
  selected?: boolean;
}

const PrometheusFlavoredType: FC<Props> = ({ selected = false }) => {
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
    />
  );
};

export default PrometheusFlavoredType;
