import React, { FC } from 'react';
import { RuleType } from './RuleType';
import { RuleFormType } from '../../../types/rule-form';

interface Props {
  selected?: boolean;
  onClick: (value: RuleFormType) => void;
}

const GrafanaManagedRuleType: FC<Props> = ({ selected = false, onClick }) => {
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
      onClick={() => onClick(RuleFormType.grafana)}
    />
  );
};

export default GrafanaManagedRuleType;
