import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { dataQa } from '@percona/platform-core';
import { EditAlertRuleTemplateModal } from './EditAlertRuleTemplateModal';

jest.mock('../AlertRuleTemplate.service');
jest.mock('app/core/app_events', () => {
  return {
    appEvents: {
      emit: jest.fn(),
    },
  };
});

describe('EditAlertRuleTemplateModal', () => {
  it('should render component correctly', () => {
    const wrapper = mount(
      <EditAlertRuleTemplateModal setVisible={jest.fn()} isVisible yaml="" getAlertRuleTemplates={jest.fn()} />
    );
    const addButton = wrapper.find(dataQa('alert-rule-template-edit-button')).find('button');

    expect(wrapper.find('textarea')).toBeTruthy();
    expect(addButton).toBeTruthy();
    expect(addButton.prop('disabled')).toBeTruthy();
    expect(wrapper.find(dataQa('alert-rule-template-cancel-button'))).toBeTruthy();
  });

  it('should not render modal when visible is set to false', () => {
    const wrapper = mount(
      <EditAlertRuleTemplateModal setVisible={jest.fn()} isVisible={false} yaml="" getAlertRuleTemplates={jest.fn()} />
    );

    expect(wrapper.contains('textarea')).toBeFalsy();
  });

  it('should call setVisible on close', () => {
    const setVisible = jest.fn();
    const wrapper = mount(
      <EditAlertRuleTemplateModal setVisible={setVisible} isVisible yaml="" getAlertRuleTemplates={jest.fn()} />
    );

    wrapper.find(dataQa('modal-background')).simulate('click');

    expect(setVisible).toHaveBeenCalled();
  });

  it('should render yaml content passed', () => {
    const wrapper = mount(
      <EditAlertRuleTemplateModal
        setVisible={jest.fn()}
        isVisible
        yaml="test content"
        getAlertRuleTemplates={jest.fn()}
      />
    );
    const addButton = wrapper.find(dataQa('alert-rule-template-edit-button')).find('button');

    expect(wrapper.find('textarea').text()).toEqual('test content');
    expect(addButton.prop('disabled')).toBeTruthy();
  });

  it('should call setVisible and getAlertRuleTemplates on submit', async () => {
    const setVisible = jest.fn();
    const getAlertRuleTemplates = jest.fn();
    const wrapper = mount(
      <EditAlertRuleTemplateModal
        setVisible={setVisible}
        isVisible
        yaml=""
        getAlertRuleTemplates={getAlertRuleTemplates}
      />
    );

    wrapper.find('textarea').simulate('change', { target: { value: 'test content' } });

    await act(async () => {
      wrapper.find('form').simulate('submit');
    });

    expect(setVisible).toHaveBeenCalledWith(false);
    expect(getAlertRuleTemplates).toHaveBeenCalled();
  });
});
