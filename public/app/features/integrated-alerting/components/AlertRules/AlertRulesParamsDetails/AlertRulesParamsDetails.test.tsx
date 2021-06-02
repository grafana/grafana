import React from 'react';
import { shallow } from 'enzyme';
import { AlertRulesParsedParam } from '../AlertRules.types';
import { AlertRulesParamsDetails } from './AlertRulesParamsDetails';
import { TemplateParamType, TemplateParamUnit } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { dataQa } from '@percona/platform-core';

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
    const wrapper = shallow(<AlertRulesParamsDetails params={params} />);
    expect(wrapper.find(dataQa('alert-rule-param'))).toHaveLength(3);
  });
});
