import { map, of } from 'rxjs';

import { DataSourceApi, DataQueryRequest, PanelData } from '@grafana/data';
import { LoadingState } from '@grafana/schema';
import { PublicAnnotationsDataSource } from 'app/features/query/state/DashboardQueryRunner/PublicAnnotationsDataSource';

import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';

const getDataSourceSrvSpy = jest.fn();
const runRequestMock = jest.fn().mockImplementation((ds: DataSourceApi, request: DataQueryRequest) => {
  const result: PanelData = {
    state: LoadingState.Loading,
    series: [],
    timeRange: request.range,
  };

  return of([]).pipe(
    map(() => {
      result.state = LoadingState.Done;
      result.series = [];

      return result;
    })
  );
});

jest.mock('app/features/query/state/DashboardQueryRunner/PublicAnnotationsDataSource');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    getDataSourceSrvSpy();
  },
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  config: {
    publicDashboardAccessToken: 'ac123',
  },
}));

describe('DashboardAnnotationsDataLayer', () => {
  it('should use PublicAnnotationsDataSource when config.publicDashboardAccessToken is set', () => {
    const dataLayer = new DashboardAnnotationsDataLayer({
      name: 'Annotations & Alerts',
      query: {
        builtIn: 1,
        datasource: {
          type: 'grafana',
          uid: '-- Grafana --',
        },
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotations & Alerts',
        target: {
          // @ts-expect-error
          limit: 100,
          matchAny: false,
          tags: [],
          type: 'dashboard',
        },
        type: 'dashboard',
      },
    });

    dataLayer.activate();

    expect(PublicAnnotationsDataSource).toHaveBeenCalledTimes(1);
    expect(getDataSourceSrvSpy).not.toHaveBeenCalled();
  });
});
