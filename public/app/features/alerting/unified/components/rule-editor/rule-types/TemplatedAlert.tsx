// @PERCONA
// This whole component is custom
import React, { FC } from 'react';

import { useTheme2 } from '@grafana/ui';

import { RuleFormType } from '../../../types/rule-form';

import { RuleType, SharedProps } from './RuleType';

const TemplatedAlertRuleType: FC<SharedProps> = ({ selected = false, disabled, onClick }) => {
  const theme = useTheme2();
  return (
    <RuleType
      name="Percona templated alert"
      description={
        <span>
          Creates an alert based on a template.
          <br />
          Simpler initial alert setup with more robust alerting options.
        </span>
      }
      image={theme.isLight ? 'public/img/icons/mono/pmm-logo-light.svg' : 'public/img/icons/mono/pmm-logo.svg'}
      selected={selected}
      disabled={disabled}
      value={RuleFormType.templated}
      onClick={onClick}
    />
  );
};

export { TemplatedAlertRuleType };
