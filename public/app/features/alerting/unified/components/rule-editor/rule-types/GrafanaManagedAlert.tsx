import React from 'react';

import { RuleFormType } from '../../../types/rule-form';

import { RuleType, SharedProps } from './RuleType';

const GrafanaManagedRuleType = ({ selected = false, disabled, onClick }: SharedProps) => {
  return (
    <RuleType
      name="Grafana managed alert"
      description={
        <span>
          Supports multiple data sources of any kind.
          <br />
          Transform data with expressions.
        </span>
      }
      image="public/img/grafana_icon.svg"
      selected={selected}
      disabled={disabled}
      value={RuleFormType.grafana}
      onClick={onClick}
    />
  );
};

export { GrafanaManagedRuleType };
