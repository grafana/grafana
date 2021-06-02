import React, { FC } from 'react';
import { getLocationSrv } from '@grafana/runtime';
import { useSelector } from 'react-redux';
import { act } from 'react-dom/test-utils';
import { mount, ReactWrapper } from 'enzyme';
import { TabbedContent } from './TabbedContent';
import { ContentTab } from './TabbedContent.types';
import { Tab, TabContent } from '@grafana/ui';

const fakeLocationUpdate = jest.fn();

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getLocationSrv: jest.fn().mockImplementation(() => ({ update: fakeLocationUpdate })),
}));

const Dummy = () => <></>;

const contentTabs: ContentTab[] = [
  {
    label: 'Tab 1',
    key: 'tab_1',
    component: <Dummy />,
  },
  {
    label: 'Tab 2',
    key: 'tab_2',
    component: <Dummy />,
  },
];

describe('TabbedContent', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation(callback => {
      return callback({ location: { routeParams: { tab: 'alerts' }, path: '/integrated-alerting/alerts' } });
    });
  });
  afterEach(() => {
    (useSelector as jest.Mock).mockClear();
    (getLocationSrv as jest.Mock).mockClear();
    fakeLocationUpdate.mockClear();
  });

  it('should show all tabs', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<TabbedContent tabs={contentTabs} basePath="" />);
    });

    expect(wrapper.find(Tab)).toHaveLength(2);
    expect(wrapper.find(TabContent).exists()).toBeTruthy();
  });

  fit('changes location when clicking on a tab', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<TabbedContent tabs={contentTabs} basePath="integrated-alerting" />);
    });
    wrapper.update();
    const tabs = wrapper.find('li');
    tabs.at(1).simulate('click');

    // The first time we render, getLocationSrv is called with the default tab
    expect(getLocationSrv).toBeCalledTimes(2);
    expect(fakeLocationUpdate).toBeCalledTimes(2);
  });

  it('changes location when trying to access a missing tab', async () => {
    (useSelector as jest.Mock).mockImplementation(callback => {
      return callback({ location: { routeParams: { tab: 'test' }, path: '/integrated-alerting/test' } });
    });

    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = mount(<TabbedContent tabs={contentTabs} basePath="integrated-alerting" />);
    });
    wrapper.update();

    expect(getLocationSrv).toBeCalledTimes(1);
    expect(fakeLocationUpdate).toBeCalledTimes(1);
    expect(fakeLocationUpdate).toBeCalledWith({ path: `/integrated-alerting/${contentTabs[0].key}` });
  });

  it('should return Content when renderTab prop is passed', async () => {
    let wrapper: ReactWrapper;
    const DummyWrapper: FC<any> = ({ children }) => <>{children}</>;

    await act(async () => {
      wrapper = mount(
        <TabbedContent
          tabs={contentTabs}
          basePath=""
          renderTab={({ Content }) => (
            <DummyWrapper>
              <Content />
            </DummyWrapper>
          )}
        />
      );
    });
    wrapper.update();

    expect(wrapper.find(DummyWrapper).exists()).toBeTruthy();
    expect(wrapper.find(TabContent).exists()).toBeTruthy();
  });
});
