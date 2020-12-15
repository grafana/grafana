import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { AlertRuleTemplateActions } from './AlertRuleTemplateActions';
import { formattedTemplateStubs } from '../__mocks__/alertRuleTemplateStubs';
import { SourceDescription } from '../AlertRuleTemplatesTable/AlertRuleTemplatesTable.types';

describe('AlertRuleTemplateActions', () => {
  it('should render component correctly', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[0]} getAlertRuleTemplates={jest.fn()} />
    );

    expect(wrapper.contains(dataQa('alert-rule-template-edit-button'))).toBeFalsy();
    expect(wrapper.find(dataQa('edit-template-button'))).toBeTruthy();
  });

  it('should open edit modal when clicking edit button', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[1]} getAlertRuleTemplates={jest.fn()} />
    );

    wrapper
      .find(dataQa('edit-template-button'))
      .find('button')
      .simulate('click');

    expect(wrapper.find(dataQa('alert-rule-template-edit-button'))).toBeTruthy();
  });

  it('should disable edit button when template is built-in', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[0]} getAlertRuleTemplates={jest.fn()} />
    );

    const editButton = wrapper.find(dataQa('edit-template-button')).find('button');

    expect(editButton.prop('disabled')).toBeTruthy();
  });
});
