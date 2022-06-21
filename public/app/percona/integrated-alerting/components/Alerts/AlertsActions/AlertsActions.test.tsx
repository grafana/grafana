import { dataTestId } from '@percona/platform-core';
import React from 'react';

import { getMount, asyncAct } from 'app/percona/shared/helpers/testUtils';

import { AlertsService } from '../Alerts.service';
import { formatAlert } from '../Alerts.utils';
import { alertsStubs } from '../__mocks__/alertsStubs';

import { AlertsActions } from './AlertsActions';
import { Bell, BellBarred } from './icons';

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
    const wrapper = await getMount(
      <AlertsActions alert={formatAlert(alertsStubs.alerts[0])} getAlerts={fakeGetAlerts} />
    );

    wrapper.update();

    expect(wrapper.find(BellBarred)).toHaveLength(1);
  });

  it('renders a bell for an silenced alert', async () => {
    const wrapper = await getMount(
      <AlertsActions alert={formatAlert(alertsStubs.alerts[3])} getAlerts={fakeGetAlerts} />
    );

    wrapper.update();

    expect(wrapper.find(Bell)).toHaveLength(1);
  });

  it('calls the API to activate a silenced alert', async () => {
    const wrapper = await getMount(
      <AlertsActions alert={formatAlert(alertsStubs.alerts[3])} getAlerts={fakeGetAlerts} />
    );

    await asyncAct(() => wrapper.find(dataTestId('silence-alert-button')).at(0).simulate('click'));
    wrapper.update();
    expect(alertsServiceToggle).toBeCalledTimes(1);
    expect(alertsServiceToggle).toBeCalledWith({ alert_id: '4', silenced: 'FALSE' }, undefined);
  });

  it('calls the API to silence an active alert', async () => {
    const wrapper = await getMount(
      <AlertsActions alert={formatAlert(alertsStubs.alerts[1])} getAlerts={fakeGetAlerts} />
    );
    await asyncAct(() => wrapper.find(dataTestId('silence-alert-button')).at(0).simulate('click'));

    wrapper.update();

    expect(alertsServiceToggle).toBeCalledTimes(1);
    expect(alertsServiceToggle).toBeCalledWith({ alert_id: '2', silenced: 'TRUE' }, undefined);
  });
});
