import React from 'react';
import { mount } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { AlertRuleTemplateActions } from './AlertRuleTemplateActions';
import { formattedTemplateStubs } from '../__mocks__/alertRuleTemplateStubs';

xdescribe('AlertRuleTemplateActions', () => {
  it('should render component correctly', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[0]} getAlertRuleTemplates={jest.fn()} />
    );

    expect(wrapper.contains(dataTestId('alert-rule-template-edit-button'))).toBeFalsy();
    expect(wrapper.find(dataTestId('edit-template-button'))).toBeTruthy();
  });

  it('should open edit modal when clicking edit button', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[1]} getAlertRuleTemplates={jest.fn()} />
    );

    wrapper.find(dataTestId('edit-template-button')).find('button').simulate('click');

    expect(wrapper.find(dataTestId('alert-rule-template-edit-button'))).toBeTruthy();
  });

  it('should open delete modal when clicking delete button', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[1]} getAlertRuleTemplates={jest.fn()} />
    );

    wrapper.find(dataTestId('delete-template-button')).find('button').simulate('click');

    expect(wrapper.find(dataTestId('confirm-delete-modal-button'))).toBeTruthy();
  });

  it('should disable edit and delete buttons when template is built-in', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[0]} getAlertRuleTemplates={jest.fn()} />
    );

    const editButton = wrapper.find(dataTestId('edit-template-button')).find('button');
    const deleteButton = wrapper.find(dataTestId('delete-template-button')).find('button');

    expect(editButton.prop('disabled')).toBeTruthy();
    expect(deleteButton.prop('disabled')).toBeTruthy();
  });

  it('should disable edit and delete buttons when template is from a file', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[2]} getAlertRuleTemplates={jest.fn()} />
    );

    const editButton = wrapper.find(dataTestId('edit-template-button')).find('button');
    const deleteButton = wrapper.find(dataTestId('delete-template-button')).find('button');

    expect(editButton.prop('disabled')).toBeTruthy();
    expect(deleteButton.prop('disabled')).toBeTruthy();
  });

  it('should disable edit and delete buttons when Portal is the template source', () => {
    const wrapper = mount(
      <AlertRuleTemplateActions template={formattedTemplateStubs[4]} getAlertRuleTemplates={jest.fn()} />
    );

    const editButton = wrapper.find(dataTestId('edit-template-button')).find('button');
    const deleteButton = wrapper.find(dataTestId('delete-template-button')).find('button');

    expect(editButton.prop('disabled')).toBeTruthy();
    expect(deleteButton.prop('disabled')).toBeTruthy();
  });
});
