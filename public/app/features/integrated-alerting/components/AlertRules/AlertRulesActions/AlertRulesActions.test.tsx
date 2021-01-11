import { dataQa } from '@percona/platform-core';
import { mount } from 'enzyme';
import React from 'react';
import { act } from 'react-dom/test-utils';

import { AlertRulesProvider } from '../AlertRules.provider';
import { formattedRulesStubs } from '../__mocks__/alertRulesStubs';

import { AlertRulesActions } from './AlertRulesActions';

jest.mock('../AlertRules.service');
jest.mock('app/core/app_events');

describe('AlertRulesActions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders an enabled switch for an enabled alert rule', () => {
    const wrapper = mount(<AlertRulesActions alertRule={formattedRulesStubs[0]} />);
    const toggle = wrapper.find(dataQa('toggle-alert-rule')).find('input');

    expect(toggle.prop('checked')).toBeTruthy();
  });

  it('renders a disabled switch for a disabled alert rule', () => {
    const wrapper = mount(<AlertRulesActions alertRule={{ ...formattedRulesStubs[0], disabled: true }} />);

    const toggle = wrapper.find(dataQa('toggle-alert-rule')).find('input');

    expect(toggle.prop('checked')).toBeFalsy();
  });

  it('calls getAlertRules on toggle', async () => {
    const alertRulesContext = {
      getAlertRules: jest.fn(),
      setAddModalVisible: jest.fn(),
      setSelectedAlertRule: jest.fn(),
      setSelectedRuleDetails: jest.fn(),
      selectedRuleDetails: formattedRulesStubs[0],
    };
    const wrapper = mount(
      <AlertRulesProvider.Provider value={alertRulesContext}>
        <AlertRulesActions alertRule={formattedRulesStubs[0]} />
      </AlertRulesProvider.Provider>
    );

    await act(async () => {
      wrapper.find(dataQa('toggle-alert-rule')).find('input').simulate('click');
    });

    expect(alertRulesContext.getAlertRules).toHaveBeenCalled();
  });
});
