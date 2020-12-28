import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { dataQa } from '@percona/platform-core';
import { AlertRulesActions } from './AlertRulesActions';
import { AlertRulesProvider } from '../AlertRules.provider';
import { formattedRulesStubs, alertRulesContextStub } from '../__mocks__/alertRulesStubs';

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
    const wrapper = mount(
      <AlertRulesProvider.Provider value={alertRulesContextStub}>
        <AlertRulesActions alertRule={formattedRulesStubs[0]} />
      </AlertRulesProvider.Provider>
    );

    await act(async () => {
      wrapper
        .find(dataQa('toggle-alert-rule'))
        .find('input')
        .simulate('click');
    });

    expect(alertRulesContextStub.getAlertRules).toHaveBeenCalled();
  });
});
