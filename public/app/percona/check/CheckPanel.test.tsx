import React from 'react';
import { dataQa } from '@percona/platform-core';
import { ReactWrapper, mount } from 'enzyme';
import { CheckPanel } from './CheckPanel';
import { CheckService } from './Check.service';
import { Messages } from './CheckPanel.messages';
import { useSelector } from 'react-redux';

jest.mock('./Check.service');
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getLocationSrv: jest.fn().mockImplementation(() => ({ update: fakeLocationUpdate })),
}));
const originalConsoleError = console.error;

// immediately resolves all pending promises: allows to run expectations after a promise
const runAllPromises = () => new Promise(setImmediate);

describe('CheckPanel::', () => {
  beforeEach(() => {
    console.error = jest.fn();
    (useSelector as jest.Mock).mockImplementation(callback => {
      return callback({ location: { routeParams: { tab: 'alerts' }, path: '/integrated-alerting/alerts' } });
    });
  });

  afterEach(() => {
    console.error = originalConsoleError;
    jest.resetAllMocks();
  });

  it('should fetch settings at startup', () => {
    const spy = jest.spyOn(CheckService, 'getSettings');

    const wrapper: ReactWrapper<{}, {}, any> = mount(<CheckPanel />);

    expect(spy).toBeCalledTimes(1);

    spy.mockClear();
    wrapper.unmount();
  });

  it('should render a spinner at startup, while loading', async () => {
    const wrapper: ReactWrapper<{}, {}, any> = mount(<CheckPanel />);

    expect(wrapper.find(dataQa('db-check-spinner'))).toHaveLength(1);

    await runAllPromises();
    wrapper.update();

    expect(wrapper.find(dataQa('db-check-spinner'))).toHaveLength(0);

    wrapper.unmount();
  });

  it('should log an error if the API call fails', () => {
    const spy = jest.spyOn(CheckService, 'getSettings').mockImplementation(() => {
      throw Error('test');
    });

    const wrapper: ReactWrapper<{}, {}, any> = mount(<CheckPanel />);

    expect(console.error).toBeCalledTimes(1);

    spy.mockClear();
    wrapper.unmount();
  });

  it('should render the link to Settings when STT is disabled', async () => {
    const spy = jest.spyOn(CheckService, 'getSettings').mockImplementation(() =>
      Promise.resolve({
        settings: {
          stt_enabled: false,
        },
      })
    );

    const wrapper: ReactWrapper<{}, {}, any> = mount(<CheckPanel />);

    await runAllPromises();
    wrapper.update();

    expect(wrapper.find(dataQa('db-check-panel-settings-link'))).toHaveLength(1);
    const text = `${Messages.pmmSettings}`;

    expect(wrapper.find(dataQa('db-check-panel-settings-link')).text()).toEqual(text);

    spy.mockClear();
    wrapper.unmount();
  });

  it('should show a message to unauthorized users', async () => {
    const UnauthorizedError = () => ({
      response: {
        status: 401,
      },
    });

    const spy = jest.spyOn(CheckService, 'getSettings').mockImplementation(() => {
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
