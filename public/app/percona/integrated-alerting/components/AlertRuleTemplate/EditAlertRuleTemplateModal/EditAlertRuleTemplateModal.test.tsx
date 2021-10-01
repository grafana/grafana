import React from 'react';
import { mount } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { EditAlertRuleTemplateModal } from './EditAlertRuleTemplateModal';
import { asyncAct } from 'app/percona/shared/helpers/testUtils';

jest.mock('../AlertRuleTemplate.service');
jest.mock('app/core/app_events');

xdescribe('EditAlertRuleTemplateModal', () => {
  it('should render component correctly', () => {
    const wrapper = mount(
      <EditAlertRuleTemplateModal
        name="template-1"
        summary="summary"
        setVisible={jest.fn()}
        isVisible
        yaml=""
        getAlertRuleTemplates={jest.fn()}
      />
    );
    const addButton = wrapper.find(dataTestId('alert-rule-template-edit-button')).find('button');

    expect(wrapper.find('textarea')).toBeTruthy();
    expect(addButton).toBeTruthy();
    expect(addButton.prop('disabled')).toBeTruthy();
    expect(wrapper.find(dataTestId('alert-rule-template-cancel-button'))).toBeTruthy();
    expect(wrapper.find(dataTestId('alert-rule-name-warning'))).toBeTruthy();
  });

  it('should not render modal when visible is set to false', () => {
    const wrapper = mount(
      <EditAlertRuleTemplateModal
        name="template-1"
        summary="summary"
        setVisible={jest.fn()}
        isVisible={false}
        yaml=""
        getAlertRuleTemplates={jest.fn()}
      />
    );

    expect(wrapper.contains('textarea')).toBeFalsy();
  });

  it('should call setVisible on close', () => {
    const setVisible = jest.fn();
    const wrapper = mount(
      <EditAlertRuleTemplateModal
        name="template-1"
        summary="summary"
        setVisible={setVisible}
        isVisible
        yaml=""
        getAlertRuleTemplates={jest.fn()}
      />
    );

    wrapper.find(dataTestId('modal-background')).simulate('click');

    expect(setVisible).toHaveBeenCalled();
  });

  it('should render yaml content passed', () => {
    const wrapper = mount(
      <EditAlertRuleTemplateModal
        name="template-1"
        summary="summary"
        setVisible={jest.fn()}
        isVisible
        yaml="test content"
        getAlertRuleTemplates={jest.fn()}
      />
    );
    const addButton = wrapper.find(dataTestId('alert-rule-template-edit-button')).find('button');

    expect(wrapper.find('textarea').text()).toEqual('test content');
    expect(addButton.prop('disabled')).toBeTruthy();
  });

  it('should call setVisible and getAlertRuleTemplates on submit', async () => {
    const setVisible = jest.fn();
    const getAlertRuleTemplates = jest.fn();
    const wrapper = mount(
      <EditAlertRuleTemplateModal
        name="template-1"
        summary="summary"
        setVisible={setVisible}
        isVisible
        yaml=""
        getAlertRuleTemplates={getAlertRuleTemplates}
      />
    );

    wrapper.find('textarea').simulate('change', { target: { value: 'test content' } });

    await asyncAct(() => wrapper.find('form').simulate('submit'));

    expect(setVisible).toHaveBeenCalledWith(false);
    expect(getAlertRuleTemplates).toHaveBeenCalled();
  });
});
