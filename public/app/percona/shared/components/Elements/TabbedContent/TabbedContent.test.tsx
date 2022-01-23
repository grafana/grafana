import React, { FC } from 'react';
import { getLocationSrv } from '@grafana/runtime';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { TabbedContent } from './TabbedContent';
import { ContentTab } from './TabbedContent.types';

const fakeLocationUpdate = jest.fn();

jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getLocationSrv: jest.fn().mockImplementation(() => ({ update: fakeLocationUpdate })),
  };
});

const Dummy = ({ ...props }) => <span {...props}></span>;

const contentTabs: ContentTab[] = [
  {
    label: 'Tab 1',
    key: 'tab_1',
    component: <Dummy role="item" />,
  },
  {
    label: 'Tab 2',
    key: 'tab_2',
    component: <Dummy role="option" />,
  },
];

describe('TabbedContent', () => {
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
    render(<TabbedContent tabs={contentTabs} basePath="" />);

    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
  });

  it('changes location when clicking on a tab', async () => {
    render(<TabbedContent tabs={contentTabs} basePath="integrated-alerting" />);

    const tab = screen.getByText('Tab 2');

    fireEvent.click(tab);

    // The first time we render, getLocationSrv is called with the default tab
    expect(getLocationSrv).toBeCalledTimes(2);
    expect(fakeLocationUpdate).toBeCalledTimes(2);
  });

  it('changes location when trying to access a missing tab', async () => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ location: { routeParams: { tab: 'test' }, path: '/integrated-alerting/test' } });
    });

    render(<TabbedContent tabs={contentTabs} basePath="integrated-alerting" />);

    expect(getLocationSrv).toBeCalledTimes(1);
    expect(fakeLocationUpdate).toBeCalledTimes(1);
    expect(fakeLocationUpdate).toBeCalledWith({ path: `/integrated-alerting/${contentTabs[0].key}` });
  });

  it('should return Content when renderTab prop is passed', async () => {
    const DummyWrapper: FC<any> = ({ children }) => <div role="main">{children}</div>;
    render(
      <TabbedContent
        tabs={contentTabs}
        activeTabName="tab_1"
        basePath=""
        renderTab={({ Content }) => (
          <DummyWrapper>
            <Content />
          </DummyWrapper>
        )}
      />
    );

    await screen.findByRole('main');

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('item')).toBeInTheDocument();
  });
});
