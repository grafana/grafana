import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { AlertRuleTemplateActions } from './AlertRuleTemplateActions';
import { formattedTemplateStubs } from '../__mocks__/alertRuleTemplateStubs';

xdescribe('AlertRuleTemplateActions', () => {
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

    wrapper.find(dataQa('edit-template-button')).find('button').simulate('click');

    expect(wrapper.find(dataQa('alert-rule-template-edit-button'))).toBeTruthy();
  });

  it('should open delete modal when clicking delete button', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[1]} getAlertRuleTemplates={jest.fn()} />
    );

    wrapper.find(dataQa('delete-template-button')).find('button').simulate('click');

    expect(wrapper.find(dataQa('confirm-delete-modal-button'))).toBeTruthy();
  });

  it('should disable edit and delete buttons when template is built-in', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[0]} getAlertRuleTemplates={jest.fn()} />
    );

    const editButton = wrapper.find(dataQa('edit-template-button')).find('button');
    const deleteButton = wrapper.find(dataQa('delete-template-button')).find('button');

    expect(editButton.prop('disabled')).toBeTruthy();
    expect(deleteButton.prop('disabled')).toBeTruthy();
  });

  it('should disable edit and delete buttons when template is from a file', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[2]} getAlertRuleTemplates={jest.fn()} />
    );

    const editButton = wrapper.find(dataQa('edit-template-button')).find('button');
    const deleteButton = wrapper.find(dataQa('delete-template-button')).find('button');

    expect(editButton.prop('disabled')).toBeTruthy();
    expect(deleteButton.prop('disabled')).toBeTruthy();
  });

  it('should disable edit and delete buttons when Portal is the template source', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[4]} getAlertRuleTemplates={jest.fn()} />
    );

    const editButton = wrapper.find(dataQa('edit-template-button')).find('button');
    const deleteButton = wrapper.find(dataQa('delete-template-button')).find('button');

    expect(editButton.prop('disabled')).toBeTruthy();
    expect(deleteButton.prop('disabled')).toBeTruthy();
  });
});
