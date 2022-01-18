import React from 'react';
import { mount } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { AlertRulesActions } from './AlertRulesActions';
import { formattedRulesStubs } from '../__mocks__/alertRulesStubs';
import { AlertRulesProvider } from '../AlertRules.provider';
import { AlertRulesContext } from '../AlertRules.types';
import { asyncAct } from 'app/percona/shared/helpers/testUtils';

const mockContext = () => ({
  setAddModalVisible: jest.fn(),
  setSelectedAlertRule: jest.fn(),
  getAlertRules: jest.fn(),
});
jest.mock('../AlertRules.service');
jest.mock('app/core/core', () => ({
  appEvents: {
    emit: jest.fn(),
  },
}));
const withContext = (values: AlertRulesContext, wrapper: JSX.Element) => (
  <AlertRulesProvider.Provider value={values}>{wrapper}</AlertRulesProvider.Provider>
);

describe('AlertRulesActions', () => {
  it('calls the API to update an alert rule on edit', async () => {
    const context = mockContext();
    const wrapper = mount(withContext(context, <AlertRulesActions alertRule={formattedRulesStubs[0]} />));

    await asyncAct(() => {
      wrapper.find(dataTestId('edit-alert-rule-button')).at(0).simulate('click');
    });

    expect(context.setSelectedAlertRule).toBeCalledTimes(1);
  });

  it('calls the API to delete an alert rule', async () => {
    const wrapper = mount(withContext(mockContext(), <AlertRulesActions alertRule={formattedRulesStubs[1]} />));

    expect(wrapper.find(dataTestId('modal-wrapper'))).toHaveLength(0);

    await asyncAct(() => {
      wrapper.find(dataTestId('delete-alert-rule-button')).at(0).simulate('click');
    });

    wrapper.update();

    expect(wrapper.find(dataTestId('modal-wrapper'))).toHaveLength(1);
  });

  it('renders an enabled switch for an enabled alert rule', () => {
    const wrapper = mount(withContext(mockContext(), <AlertRulesActions alertRule={formattedRulesStubs[0]} />));
    const toggle = wrapper.find(dataTestId('toggle-alert-rule')).find('input');

    expect(toggle.prop('checked')).toBeTruthy();
  });

  it('renders a disabled switch for a disabled alert rule', () => {
    const wrapper = mount(
      withContext(mockContext(), <AlertRulesActions alertRule={{ ...formattedRulesStubs[0], disabled: true }} />)
    );

    const toggle = wrapper.find(dataTestId('toggle-alert-rule')).find('input');

    expect(toggle.prop('checked')).toBeFalsy();
  });

  it('calls getAlertRules on toggle', async () => {
    const context = mockContext();
    const wrapper = mount(withContext(context, <AlertRulesActions alertRule={formattedRulesStubs[0]} />));
    await asyncAct(() => {
      wrapper.find(dataTestId('toggle-alert-rule')).find('input').simulate('click');
    });

    expect(context.getAlertRules).toHaveBeenCalled();
  });
});
