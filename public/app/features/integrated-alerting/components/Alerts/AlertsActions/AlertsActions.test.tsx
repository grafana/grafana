import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { AlertsActions } from './AlertsActions';
import { alertsStubs } from '../__mocks__/alertsStubs';
import { formatAlert } from '../AlertsTable/AlertsTable.utils';
import { Bell, BellBarred } from './icons';
import { AlertsService } from '../Alerts.service';

jest.mock('../Alerts.service');

const fakeGetAlerts = jest.fn();

const alertsServiceToggle = jest.spyOn(AlertsService, 'toggle');

describe('AlertActions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a barred bell for an active alert', () => {
    const wrapper = mount(<AlertsActions alert={formatAlert(alertsStubs[0])} getAlerts={fakeGetAlerts} />);

    expect(wrapper.find(BellBarred)).toHaveLength(1);
  });

  it('renders a bell for an silenced alert', () => {
    const wrapper = mount(<AlertsActions alert={formatAlert(alertsStubs[3])} getAlerts={fakeGetAlerts} />);

    expect(wrapper.find(Bell)).toHaveLength(1);
  });

  it('calls the API to activate a silenced alert', () => {
    const wrapper = mount(<AlertsActions alert={formatAlert(alertsStubs[3])} getAlerts={fakeGetAlerts} />);

    wrapper
      .find(dataQa('silence-alert-button'))
      .at(0)
      .simulate('click');

    expect(alertsServiceToggle).toBeCalledTimes(1);
    expect(alertsServiceToggle).toBeCalledWith({ alert_id: '4', silenced: 'FALSE' });
  });

  it('calls the API to silence an active alert', () => {
    const wrapper = mount(<AlertsActions alert={formatAlert(alertsStubs[1])} getAlerts={fakeGetAlerts} />);

    wrapper
      .find(dataQa('silence-alert-button'))
      .at(0)
      .simulate('click');

    expect(alertsServiceToggle).toBeCalledTimes(1);
    expect(alertsServiceToggle).toBeCalledWith({ alert_id: '2', silenced: 'TRUE' });
  });
});
