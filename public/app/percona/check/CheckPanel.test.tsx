import React from 'react';
import { dataQa } from '@percona/platform-core';
import { ReactWrapper, mount } from 'enzyme';
import { CheckPanel } from './CheckPanel';
import { Messages } from './CheckPanel.messages';
import { useSelector } from 'react-redux';
import { SettingsService } from '../settings/Settings.service';

const fakeLocationUpdate = jest.fn();

jest.mock('./Check.service');
jest.mock('../settings/Settings.service');
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getLocationSrv: jest.fn().mockImplementation(() => ({ update: fakeLocationUpdate })),
}));

jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

// immediately resolves all pending promises: allows to run expectations after a promise
const runAllPromises = () => new Promise(setImmediate);

describe('CheckPanel::', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation(callback => {
      return callback({ location: { routeParams: { tab: 'alerts' }, path: '/integrated-alerting/alerts' } });
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should show a message to unauthorized users', async () => {
    const UnauthorizedError = () => ({
      response: {
        status: 401,
      },
    });

    const spy = jest.spyOn(SettingsService, 'getSettings').mockImplementation(() => {
      throw UnauthorizedError();
    });

    const wrapper: ReactWrapper<{}, {}, any> = mount(<CheckPanel />);

    await runAllPromises();
    wrapper.update();

    expect(wrapper.find(dataQa('db-check-panel-unauthorized'))).toHaveLength(1);
    expect(wrapper.find(dataQa('db-check-panel-unauthorized')).text()).toEqual(Messages.unauthorized);

    spy.mockClear();
    wrapper.unmount();
  });
});
