import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { dataQa } from '@percona/platform-core';
import { AddAlertRuleTemplateModal } from './AddAlertRuleTemplateModal';

jest.mock('../AlertRuleTemplate.service');
jest.mock('app/core/app_events');

describe('AddAlertRuleTemplateModal', () => {
  it('should render component correctly', () => {
    const wrapper = mount(
      <AddAlertRuleTemplateModal setVisible={jest.fn()} getAlertRuleTemplates={jest.fn()} isVisible />
    );
    const addButton = wrapper.find(dataQa('alert-rule-template-add-button')).find('button');

    expect(wrapper.find('textarea')).toBeTruthy();
    expect(wrapper.find(dataQa('alert-rule-template-upload-button')).find('button')).toBeTruthy();
    expect(wrapper.find(dataQa('alert-rule-template-cancel-button')).find('button')).toBeTruthy();
    expect(addButton).toBeTruthy();
    expect(addButton.prop('disabled')).toBeTruthy();
  });

  it('should not render modal when visible is set to false', () => {
    const wrapper = mount(
      <AddAlertRuleTemplateModal setVisible={jest.fn()} getAlertRuleTemplates={jest.fn()} isVisible={false} />
    );

    expect(wrapper.contains('textarea')).toBeFalsy();
  });

  it('should call setVisible on close', () => {
    const setVisible = jest.fn();
    const wrapper = mount(
      <AddAlertRuleTemplateModal setVisible={setVisible} getAlertRuleTemplates={jest.fn()} isVisible />
    );

    wrapper.find(dataQa('modal-background')).simulate('click');

    expect(setVisible).toHaveBeenCalled();
  });

  it('should call setVisible and getAlertRuleTemplates on submit', async () => {
    const setVisible = jest.fn();
    const getAlertRuleTemplates = jest.fn();
    const wrapper = mount(
      <AddAlertRuleTemplateModal setVisible={setVisible} getAlertRuleTemplates={getAlertRuleTemplates} isVisible />
    );

    wrapper.find('textarea').simulate('change', { target: { value: 'test content' } });

    await act(async () => {
      wrapper.find('form').simulate('submit');
    });

    expect(setVisible).toHaveBeenCalledWith(false);
    expect(getAlertRuleTemplates).toHaveBeenCalled();
  });
});
