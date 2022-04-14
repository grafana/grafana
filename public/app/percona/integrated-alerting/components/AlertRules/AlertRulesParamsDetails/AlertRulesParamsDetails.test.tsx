import React from 'react';
import { AlertRulesParsedParam } from '../AlertRules.types';
import { AlertRulesParamsDetails } from './AlertRulesParamsDetails';
import { TemplateParamType, TemplateParamUnit } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { render, screen } from '@testing-library/react';

describe('AlertRulesParamsDetails', () => {
  it('should display all params', () => {
    const params: AlertRulesParsedParam[] = [
      {
        name: 'param_1',
        summary: '',
        type: TemplateParamType.FLOAT,
        unit: TemplateParamUnit.PERCENTAGE,
        value: 10,
      },
      {
        name: 'param_2',
        summary: '',
        type: TemplateParamType.BOOL,
        unit: TemplateParamUnit.PERCENTAGE,
        value: true,
      },
      {
        name: 'param_3',
        summary: '',
        type: TemplateParamType.STRING,
        unit: TemplateParamUnit.SECONDS,
        value: '10s',
      },
    ];
    render(<AlertRulesParamsDetails params={params} />);
    expect(screen.getAllByTestId('alert-rule-param')).toHaveLength(3);
  });
});
