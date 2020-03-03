import React from 'react';
import { DataSourceApi, LoadingState, ExploreMode, toUtc, DataQueryError, DataQueryRequest } from '@grafana/data';
import { ExploreId } from 'app/types/explore';
import { shallow } from 'enzyme';
import { Explore, ExploreProps } from './Explore';
import { scanStopAction } from './state/actionTypes';
import { toggleGraph } from './state/actions';

const setup = (renderMethod: any, propOverrides?: object) => {
  const props: ExploreProps = {
    changeSize: jest.fn(),
    datasourceInstance: {
      meta: {
        metrics: true,
        logs: true,
      },
      components: {
        ExploreStartPage: {},
      },
    } as DataSourceApi,
    datasourceMissing: false,
    exploreId: ExploreId.left,
    initializeExplore: jest.fn(),
    initialized: true,
    modifyQueries: jest.fn(),
    update: {
      datasource: false,
      queries: false,
      range: false,
      mode: false,
      ui: false,
    },
    refreshExplore: jest.fn(),
    scanning: false,
    scanRange: {
      from: '0',
      to: '0',
    },
    scanStart: jest.fn(),
    scanStopAction: scanStopAction,
    setQueries: jest.fn(),
    split: false,
    queryKeys: [],
    initialDatasource: 'test',
    initialQueries: [],
    initialRange: {
      from: toUtc('2019-01-01 10:00:00'),
      to: toUtc('2019-01-01 16:00:00'),
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    },
    mode: ExploreMode.Metrics,
    initialUI: {
      showingTable: false,
      showingGraph: false,
      showingLogs: false,
    },
    isLive: false,
    syncedTimes: false,
    updateTimeRange: jest.fn(),
    graphResult: [],
    loading: false,
    absoluteRange: {
      from: 0,
      to: 0,
    },
    showingGraph: false,
    showingTable: false,
    timeZone: 'UTC',
    onHiddenSeriesChanged: jest.fn(),
    toggleGraph: toggleGraph,
    queryResponse: {
      state: LoadingState.Done,
      series: [],
      request: {} as DataQueryRequest,
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
  };

  Object.assign(props, propOverrides);
  return renderMethod(<Explore {...props} />);
};

describe('Explore', () => {
  it('should render component', () => {
    const wrapper = setup(shallow);
    expect(wrapper).toMatchSnapshot();
  });
});
