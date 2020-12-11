import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { AlertRuleTemplate } from './AlertRuleTemplate';

describe('AlertRuleTemplate', () => {
  it('should render add modal', () => {
    const wrapper = mount(<AlertRuleTemplate />);

    expect(wrapper.find('textarea')).toBeTruthy();
    expect(wrapper.contains(dataQa('modal-wrapper'))).toBeFalsy();

    wrapper.find(dataQa('alert-rule-template-add-modal-button')).find('button').simulate('click');

    expect(wrapper.find(dataQa('modal-wrapper'))).toBeTruthy();
  });
});
