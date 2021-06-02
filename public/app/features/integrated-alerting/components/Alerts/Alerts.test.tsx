import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { Alerts } from './Alerts';
import { act } from 'react-dom/test-utils';
import { alertsStubs } from './__mocks__/alertsStubs';
import { AlertsService } from './Alerts.service';

jest.mock('./Alerts.service', () => ({
  AlertsService: {
    list: () => ({
      alerts: alertsStubs,
    }),
  },
}));

describe('AlertsTable', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the table correctly', async () => {
    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = await mount(<Alerts />);
    });

    wrapper.update();

    expect(wrapper.find(dataQa('table-thead')).find('tr')).toHaveLength(1);
    expect(wrapper.find(dataQa('table-tbody')).find('tr')).toHaveLength(6);
    expect(wrapper.find(dataQa('table-no-data'))).toHaveLength(0);
  });

  it('should have table initially loading', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = await mount(<Alerts />);
    });

    expect(wrapper.find(dataQa('table-loading')).exists()).toBeTruthy();
  });

  it('should render correctly without data', async () => {
    jest.spyOn(AlertsService, 'list').mockReturnValueOnce(Promise.resolve({ alerts: [] }));
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = await mount(<Alerts />);
    });

    wrapper.update();

    expect(wrapper.find(dataQa('table-thead')).find('tr')).toHaveLength(0);
    expect(wrapper.find(dataQa('table-tbody')).find('tr')).toHaveLength(0);
    expect(wrapper.find(dataQa('table-no-data'))).toHaveLength(1);
  });
});
