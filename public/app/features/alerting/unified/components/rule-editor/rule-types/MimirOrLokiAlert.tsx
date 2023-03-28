import React from 'react';

import { RuleFormType } from '../../../types/rule-form';

import { DisabledTooltip } from './DisabledTooltip';
import { RuleType, SharedProps } from './RuleType';

interface Props extends SharedProps {
  onClick: (value: RuleFormType) => void;
}

const MimirFlavoredType = ({ selected = false, disabled = false, onClick }: Props) => {
  return (
    <DisabledTooltip visible={disabled}>
      <RuleType
        name="Mimir or Loki alert"
        description={
          <span>
            Use a Mimir, Loki or Cortex datasource.
            <br />
            Expressions are not supported.
          </span>
        }
        image="public/img/alerting/mimir_logo.svg"
        selected={selected}
        disabled={disabled}
        value={RuleFormType.cloudAlerting}
        onClick={onClick}
      />
    </DisabledTooltip>
  );
};

export { MimirFlavoredType };
