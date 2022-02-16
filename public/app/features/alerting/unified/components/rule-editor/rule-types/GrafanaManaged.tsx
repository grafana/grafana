import React, { FC } from 'react';
import RuleType from './RuleType';

interface Props {
  selected?: boolean;
}

const GrafanaManagedRuleType: FC<Props> = ({ selected = false }) => {
  return (
    <RuleType
      name="Grafana managed"
      description={
        <p>
          Use any data source.
          <br />
          Transform data with expressions.
        </p>
      }
      image="/public/img/grafana_icon.svg"
      selected={selected}
    />
  );
};

export default GrafanaManagedRuleType;
