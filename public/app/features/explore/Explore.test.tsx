import React from 'react';
import { DataSourceApi, LoadingState, toUtc, DataQueryError, DataQueryRequest, CoreApp } from '@grafana/data';
import { getFirstNonQueryRowSpecificError } from 'app/core/utils/explore';
import { ExploreId } from 'app/types/explore';
import { shallow } from 'enzyme';
import { Explore, ExploreProps } from './Explore';
import { scanStopAction } from './state/query';
import { SecondaryActions } from './SecondaryActions';
import { getTheme } from '@grafana/ui';

const dummyProps: ExploreProps = {
  changeSize: jest.fn(),
  datasourceInstance: {
    meta: {
      metrics: true,
      logs: true,
    },
    components: {
      QueryEditorHelp: {},
    },
  } as DataSourceApi,
  datasourceMissing: false,
  exploreId: ExploreId.left,
  loading: false,
  modifyQueries: jest.fn(),
  scanning: false,
  scanRange: {
    from: '0',
    to: '0',
  },
  scanStart: jest.fn(),
  scanStopAction: scanStopAction,
  setQueries: jest.fn(),
  queryKeys: [],
  isLive: false,
  syncedTimes: false,
  updateTimeRange: jest.fn(),
  graphResult: [],
  absoluteRange: {
    from: 0,
    to: 0,
  },
  timeZone: 'UTC',
  onHiddenSeriesChanged: jest.fn(),
  queryResponse: {
    state: LoadingState.NotStarted,
    series: [],
    request: ({
      requestId: '1',
      dashboardId: 0,
      interval: '1s',
      panelId: 1,
      scopedVars: {
        apps: {
          value: 'value',
        },
      },
      targets: [
        {
          refId: 'A',
        },
      ],
      timezone: 'UTC',
      app: CoreApp.Explore,
      startTime: 0,
    } as unknown) as DataQueryRequest,
    error: {} as DataQueryError,
    timeRange: {
      from: toUtc('2019-01-01 10:00:00'),
      to: toUtc('2019-01-01 16:00:00'),
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    },
  },
  originPanelId: 1,
  addQueryRow: jest.fn(),
  theme: getTheme(),
  showMetrics: true,
  showLogs: true,
  showTable: true,
  showTrace: true,
  showNodeGraph: true,
  splitOpen: (() => {}) as any,
};

const setupErrors = (hasRefId?: boolean) => {
  return [
    {
      message: 'Error message',
      status: '400',
      statusText: 'Bad Request',
      refId: hasRefId ? 'A' : '',
    },
  ];
};

describe('Explore', () => {
  it('should render component', () => {
    const wrapper = shallow(<Explore {...dummyProps} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders SecondaryActions and add row button', () => {
    const wrapper = shallow(<Explore {...dummyProps} />);
    expect(wrapper.find(SecondaryActions)).toHaveLength(1);
    expect(wrapper.find(SecondaryActions).props().addQueryRowButtonHidden).toBe(false);
  });

  it('should filter out a query-row-specific error when looking for non-query-row-specific errors', async () => {
    const queryErrors = setupErrors(true);
    const queryError = getFirstNonQueryRowSpecificError(queryErrors);
    expect(queryError).toBeUndefined();
  });

  it('should not filter out a generic error when looking for non-query-row-specific errors', async () => {
    const queryErrors = setupErrors();
    const queryError = getFirstNonQueryRowSpecificError(queryErrors);
    expect(queryError).toEqual({
      message: 'Error message',
      status: '400',
      statusText: 'Bad Request',
      refId: '',
    });
  });
});
