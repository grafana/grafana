import { map, of } from 'rxjs';

import { DataSourceApi, DataQueryRequest, DataTopic, PanelData, LoadingState, toDataFrame } from '@grafana/data';
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
    ...jest.requireActual('@grafana/runtime').config,
    publicDashboardAccessToken: 'ac123',
  },
}));

describe('DashboardAnnotationsDataLayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('should put annotation data in series with DataTopic.Annotations so data layers can merge it', (done) => {
    runRequestMock.mockImplementation((ds: DataSourceApi, request: DataQueryRequest) => {
      return of(null).pipe(
        map(() => ({
          state: LoadingState.Done,
          series: [
            toDataFrame({
              fields: [
                { name: 'time', values: [1000, 2000] },
                { name: 'text', values: ['annotation 1', 'annotation 2'] },
              ],
            }),
          ],
          timeRange: request.range,
        }))
      );
    });

    const dataLayer = new DashboardAnnotationsDataLayer({
      name: 'Test',
      query: {
        enable: true,
        iconColor: 'red',
        name: 'Test',
      },
    });

    dataLayer.activate();

    dataLayer.getResultsStream().subscribe((result) => {
      if (result.data.state === LoadingState.Done) {
        expect(result.data.series).toHaveLength(1);
        expect(result.data.annotations).toBeUndefined();
        expect(result.data.series[0].meta?.dataTopic).toBe(DataTopic.Annotations);
        done();
      }
    });
  });
});
