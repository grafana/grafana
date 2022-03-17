import React, { FC } from 'react';
import { RuleType, SharedProps } from './RuleType';
import { RuleFormType } from '../../../types/rule-form';

const GrafanaManagedRuleType: FC<SharedProps> = ({ selected = false, disabled, onClick }) => {
  return (
    <RuleType
      name="Grafana managed alert"
      description={
        <div>
          Supports multiple data sources of any kind.
          <br />
          Transform data with expressions.
        </div>
      }
      image="/public/img/grafana_icon.svg"
      selected={selected}
      disabled={disabled}
      value={RuleFormType.grafana}
      onClick={onClick}
    />
  );
};

export { GrafanaManagedRuleType };
