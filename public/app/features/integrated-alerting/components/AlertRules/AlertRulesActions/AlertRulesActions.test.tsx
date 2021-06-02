import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { dataQa } from '@percona/platform-core';
import { AlertRulesActions } from './AlertRulesActions';
import { rulesStubs, formattedRulesStubs } from '../__mocks__/alertRulesStubs';
import { AlertRulesService } from '../AlertRules.service';
import { Messages } from './AlertRulesActions.messages';
import { AlertRulesProvider } from '../AlertRules.provider';
import { AlertRulesContext } from '../AlertRules.types';

const mockContext = () => ({
  setAddModalVisible: jest.fn(),
  setSelectedAlertRule: jest.fn(),
  setSelectedRuleDetails: jest.fn(),
  getAlertRules: jest.fn(),
  selectedRuleDetails: formattedRulesStubs[0],
});
jest.mock('../AlertRules.service');
jest.mock('app/core/core', () => ({
  appEvents: {
    emit: jest.fn(),
  },
}));
const alertRulesServiceCreate = jest.spyOn(AlertRulesService, 'create');
const withContext = (values: AlertRulesContext, wrapper: JSX.Element) => (
  <AlertRulesProvider.Provider value={values}>{wrapper}</AlertRulesProvider.Provider>
);

describe('AlertRulesActions', () => {
  it('calls the API to crate an alert rule on copy', async () => {
    const testRule = rulesStubs[1];

    const wrapper = mount(withContext(mockContext(), <AlertRulesActions alertRule={formattedRulesStubs[1]} />));

    const expectedResult = {
      ...testRule,
      disabled: true,
      summary: `${Messages.copyOf} ${testRule.summary}`,
      custom_labels: undefined as any,
      channel_ids: ['test_ch'],
      template_name: 'test 2',
    };

    await act(async () => {
      wrapper
        .find(dataQa('copy-alert-rule-button'))
        .at(0)
        .simulate('click');
    });

    expect(alertRulesServiceCreate).toBeCalledTimes(1);
    expect(alertRulesServiceCreate).toBeCalledWith(expectedResult);
  });

  it('calls the API to update an alert rule on edit', async () => {
    const context = mockContext();
    const wrapper = mount(withContext(context, <AlertRulesActions alertRule={formattedRulesStubs[0]} />));

    await act(async () => {
      wrapper
        .find(dataQa('edit-alert-rule-button'))
        .at(0)
        .simulate('click');
    });

    expect(context.setSelectedAlertRule).toBeCalledTimes(1);
  });

  it('calls the API to delete an alert rule', async () => {
    const wrapper = mount(withContext(mockContext(), <AlertRulesActions alertRule={formattedRulesStubs[1]} />));

    expect(wrapper.find(dataQa('modal-wrapper'))).toHaveLength(0);

    await act(async () => {
      wrapper
        .find(dataQa('delete-alert-rule-button'))
        .at(0)
        .simulate('click');
    });

    wrapper.update();

    expect(wrapper.find(dataQa('modal-wrapper'))).toHaveLength(1);
  });

  it('renders an enabled switch for an enabled alert rule', () => {
    const wrapper = mount(withContext(mockContext(), <AlertRulesActions alertRule={formattedRulesStubs[0]} />));
    const toggle = wrapper.find(dataQa('toggle-alert-rule')).find('input');

    expect(toggle.prop('checked')).toBeTruthy();
  });

  it('renders a disabled switch for a disabled alert rule', () => {
    const wrapper = mount(
      withContext(mockContext(), <AlertRulesActions alertRule={{ ...formattedRulesStubs[0], disabled: true }} />)
    );

    const toggle = wrapper.find(dataQa('toggle-alert-rule')).find('input');

    expect(toggle.prop('checked')).toBeFalsy();
  });

  it('calls getAlertRules on toggle', async () => {
    const context = mockContext();
    const wrapper = mount(withContext(context, <AlertRulesActions alertRule={formattedRulesStubs[0]} />));
    await act(async () => {
      wrapper
        .find(dataQa('toggle-alert-rule'))
        .find('input')
        .simulate('click');
    });

    expect(context.getAlertRules).toHaveBeenCalled();
  });
});
