import React from 'react';
import { act } from 'react-dom/test-utils';
import { mount, ReactWrapper, shallow, ShallowWrapper } from 'enzyme';
import IntegratedAlertingPage from './IntegratedAlertingPage';
import { getLocationSrv } from '@grafana/runtime';
import { Tab, TabContent } from '@grafana/ui';
import { useSelector } from 'react-redux';
import { DEFAULT_TAB } from './IntegratedAlerting.constants';

const fakeLocationUpdate = jest.fn();

jest.mock('app/percona/settings/Settings.service');
jest.mock('./components/Alerts/Alerts.service');
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getLocationSrv: jest.fn().mockImplementation(() => ({ update: fakeLocationUpdate })),
}));

jest.mock('./components/Alerts/Alerts.service');

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

  it('should show all tabs', async () => {
    let wrapper: ShallowWrapper;

    await act(async () => {
      wrapper = await shallow(<IntegratedAlertingPage />);
    });

    expect(wrapper.find(Tab)).toHaveLength(4);
    expect(wrapper.find(TabContent).exists()).toBeTruthy();
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
