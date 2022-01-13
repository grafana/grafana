import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { useSelector } from 'react-redux';
import { getLocationSrv } from '@grafana/runtime';
import { act } from 'react-dom/test-utils';
import IntegratedAlertingPage from './IntegratedAlertingPage';
import { Messages } from './IntegratedAlerting.messages';
import { DEFAULT_TAB } from './IntegratedAlerting.constants';
import { alertsStubs } from './components/Alerts/__mocks__/alertsStubs';

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

const fakeLocationUpdate = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getLocationSrv: jest.fn().mockImplementation(() => ({ update: fakeLocationUpdate })),
}));

jest.mock('./components/Alerts/Alerts.service', () => ({
  AlertsService: {
    list: () => ({
      alerts: alertsStubs,
    }),
  },
}));

describe('IntegratedAlertingPage', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ location: { routeParams: { tab: 'alerts' }, path: '/integrated-alerting/alerts' } });
    });
  });
  afterEach(() => {
    (useSelector as jest.Mock).mockClear();
    (getLocationSrv as jest.Mock).mockClear();
    fakeLocationUpdate.mockClear();
  });

  it('renders the page', async () => {
    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = mount(<IntegratedAlertingPage />);
    });
    const tabs = wrapper.find('ul');

    expect(tabs.children().length).toBe(4);
    expect(tabs.find('li').at(0).text()).toEqual(Messages.tabs.alerts);
  });

  it('changes location when clicking on a tab', async () => {
    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = mount(<IntegratedAlertingPage />);
    });
    wrapper.update();
    const tabs = wrapper.find('ul');

    tabs.children().at(1).simulate('click');

    expect(getLocationSrv).toBeCalledTimes(1);
    expect(fakeLocationUpdate).toBeCalledTimes(1);
  });

  it('changes location when trying to access a missing tab', async () => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ location: { routeParams: { tab: 'test' }, path: '/integrated-alerting/test' } });
    });

    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = mount(<IntegratedAlertingPage />);
    });
    wrapper.update();

    expect(getLocationSrv).toBeCalledTimes(1);
    expect(fakeLocationUpdate).toBeCalledTimes(1);
    expect(fakeLocationUpdate).toBeCalledWith({ path: `integrated-alerting/${DEFAULT_TAB}` });
  });
});
