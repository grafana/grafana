import React from 'react';
import { shallow } from 'enzyme';
import { TemplateParam, TemplateParamType, TemplateParamUnit } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { AlertRuleParamField } from './AlertRuleParamField';
import { NumberInputField } from '@percona/platform-core';

describe('AlertRuleParamField', () => {
  const param: TemplateParam = {
    name: 'param',
    type: TemplateParamType.FLOAT,
    unit: TemplateParamUnit.SECONDS,
    summary: 'float param',
    float: {
      hasDefault: true,
      hasMin: true,
      hasMax: false,
    },
  };

  it('should return null if unsupported type is passed', () => {
    const wrapper = shallow(<AlertRuleParamField param={param} />);
    expect(wrapper.children()).toHaveLength(0);
  });

  it('should render supported type fields', () => {
    const wrapper = shallow(<AlertRuleParamField param={param} />);
    expect(wrapper.find(NumberInputField).exists()).toBeTruthy();
  });

  it('should have validators', () => {
    const wrapper = shallow(<AlertRuleParamField param={param} />);
    expect(wrapper.find(NumberInputField).prop('validators')).toHaveLength(2);
  });
});
