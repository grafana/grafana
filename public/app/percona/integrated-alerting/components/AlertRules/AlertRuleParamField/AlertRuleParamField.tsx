import React, { FC } from 'react';
import { NumberInputField, validators } from '@percona/platform-core';
import { TemplateParamType } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { AlertRuleParamFieldProps } from './AlertRuleParamField.types';
import { Messages } from './AlertRuleParamField.messages';
import { minValidator, maxValidator } from '../AddAlertRuleModal/AddAlertRuleModal.utils';

export const AlertRuleParamField: FC<AlertRuleParamFieldProps> = ({ param }) => {
  const { name, type, unit, summary, float } = param;
  const floatValidators: any[] = [validators.required];

  if (float?.hasMin) {
    floatValidators.push(minValidator(float.min || 0));
  }

  if (float?.hasMax) {
    floatValidators.push(maxValidator(float.max || 0));
  }

  // TODO add remaining params as API starts supporting them
  // https://github.com/percona/pmm-managed/blob/PMM-2.0/models/template_model.go#L112
  const componentMap: Record<TemplateParamType, JSX.Element | null> = {
    [TemplateParamType.FLOAT]: (
      <NumberInputField
        name={name}
        label={Messages.getFloatDescription(name, summary, unit, float)}
        validators={floatValidators}
        placeholder={`${float?.default}`}
      />
    ),
    [TemplateParamType.BOOL]: null,
    [TemplateParamType.STRING]: null,
  };

  return componentMap[type];
};
