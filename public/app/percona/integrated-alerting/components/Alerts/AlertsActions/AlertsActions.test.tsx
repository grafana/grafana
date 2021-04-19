import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { dataQa } from '@percona/platform-core';
import { AlertsActions } from './AlertsActions';
import { alertsStubs } from '../__mocks__/alertsStubs';
import { formatAlert } from '../Alerts.utils';
import { Bell, BellBarred } from './icons';
import { AlertsService } from '../Alerts.service';

jest.mock('app/percona/shared/components/hooks/cancelToken.hook');
jest.mock('../Alerts.service');
jest.mock('app/core/core', () => ({
  appEvents: {
    emit: jest.fn(),
  },
}));

const fakeGetAlerts = jest.fn();

const alertsServiceToggle = jest.spyOn(AlertsService, 'toggle');

describe('AlertActions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a barred bell for an active alert', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = await mount(<AlertsActions alert={formatAlert(alertsStubs[0])} getAlerts={fakeGetAlerts} />);
    });

    wrapper.update();

    expect(wrapper.find(BellBarred)).toHaveLength(1);
  });

  it('renders a bell for an silenced alert', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = await mount(<AlertsActions alert={formatAlert(alertsStubs[3])} getAlerts={fakeGetAlerts} />);
    });

    wrapper.update();

    expect(wrapper.find(Bell)).toHaveLength(1);
  });

  it('calls the API to activate a silenced alert', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = await mount(<AlertsActions alert={formatAlert(alertsStubs[3])} getAlerts={fakeGetAlerts} />);
      wrapper
        .find(dataQa('silence-alert-button'))
        .at(0)
        .simulate('click');
    });
    wrapper.update();
    expect(alertsServiceToggle).toBeCalledTimes(1);
    expect(alertsServiceToggle).toBeCalledWith({ alert_id: '4', silenced: 'FALSE' }, undefined);
  });

  it('calls the API to silence an active alert', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = await mount(<AlertsActions alert={formatAlert(alertsStubs[1])} getAlerts={fakeGetAlerts} />);
      wrapper
        .find(dataQa('silence-alert-button'))
        .at(0)
        .simulate('click');
    });

    wrapper.update();

    expect(alertsServiceToggle).toBeCalledTimes(1);
    expect(alertsServiceToggle).toBeCalledWith({ alert_id: '2', silenced: 'TRUE' }, undefined);
  });
});
