import { PrometheusDatasource } from './datasource';
import { DataSourceInstanceSettings } from '@grafana/data';
import { PromContext, PromOptions } from './types';
import { dateTime, LoadingState } from '@grafana/data';
import * as Backend from 'app/core/services/backend_srv';

jest.mock('app/core/services/backend_srv');

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  __esModule: true,
  getTimeSrv: jest.fn().mockReturnValue({
    timeRange(): any {
      return {
        from: dateTime(),
        to: dateTime(),
      };
    },
  }),
}));

jest.mock('app/features/templating/template_srv', () => {
  return {
    replace: jest.fn(() => null),
    getAdhocFilters: jest.fn((): any[] => []),
  };
});

const getBackendSrvMock = (Backend.getBackendSrv as any) as jest.Mock<Backend.BackendSrv>;

beforeEach(() => {
  getBackendSrvMock.mockClear();
});

const defaultInstanceSettings: DataSourceInstanceSettings<PromOptions> = {
  url: 'test_prom',
  jsonData: {},
} as any;

describe('datasource', () => {
  describe('query', () => {
    let ds: PrometheusDatasource;
    beforeEach(() => {
      ds = new PrometheusDatasource(defaultInstanceSettings);
    });

    it('returns empty array when no queries', done => {
      expect.assertions(2);
      getBackendSrvMock.mockImplementation(
        () =>
          ({
            get: jest.fn(),
            getDashboard: jest.fn(),
            getDashboardByUid: jest.fn(),
            getFolderByUid: jest.fn(),
            post: jest.fn(),
            resolveCancelerIfExists: jest.fn(),
            datasourceRequest: () => Promise.resolve(makePromResponse()),
          } as any)
      );

      ds.query(makeQuery([])).subscribe({
        next(next) {
          expect(next.data).toEqual([]);
          expect(next.state).toBe(LoadingState.Done);
        },
        complete() {
          done();
        },
      });
    });

    it('performs time series queries', done => {
      expect.assertions(2);
      ds.query(makeQuery([{}])).subscribe({
        next(next) {
          expect(next.data.length).not.toBe(0);
          expect(next.state).toBe(LoadingState.Done);
        },
        complete() {
          done();
        },
      });
    });

    it('with 2 queries and used from Explore, sends results as they arrive', done => {
      expect.assertions(4);
      getBackendSrvMock.mockImplementation(
        () =>
          ({
            get: jest.fn(),
            getDashboard: jest.fn(),
            getDashboardByUid: jest.fn(),
            getFolderByUid: jest.fn(),
            post: jest.fn(),
            resolveCancelerIfExists: jest.fn(),
            datasourceRequest: () => Promise.resolve(makePromResponse()),
          } as any)
      );

      const responseStatus = [LoadingState.Loading, LoadingState.Done];
      ds.query(makeQuery([{ context: PromContext.Explore }, { context: PromContext.Explore }])).subscribe({
        next(next) {
          expect(next.data.length).not.toBe(0);
          expect(next.state).toBe(responseStatus.shift());
        },
        complete() {
          done();
        },
      });
    });

    it('with 2 queries and used from Panel, waits for all to finish until sending Done status', done => {
      expect.assertions(2);
      getBackendSrvMock.mockImplementation(
        () =>
          ({
            get: jest.fn(),
            getDashboard: jest.fn(),
            getDashboardByUid: jest.fn(),
            getFolderByUid: jest.fn(),
            post: jest.fn(),
            resolveCancelerIfExists: jest.fn(),
            datasourceRequest: () => Promise.resolve(makePromResponse()),
          } as any)
      );
      ds.query(makeQuery([{ context: PromContext.Panel }, { context: PromContext.Panel }])).subscribe({
        next(next) {
          expect(next.data.length).not.toBe(0);
          expect(next.state).toBe(LoadingState.Done);
        },
        complete() {
          done();
        },
      });
    });
  });
});

function makeQuery(targets: any[]): any {
  return {
    targets: targets.map(t => {
      return {
        instant: false,
        start: dateTime().subtract(5, 'minutes'),
        end: dateTime(),
        expr: 'test',
        showingGraph: true,
        ...t,
      };
    }),
    range: {
      from: dateTime(),
      to: dateTime(),
    },
    interval: '15s',
  };
}

/**
 * Creates a pretty bogus prom response. Definitelly needs more work but right now we do not test the contents of the
 * messages anyway.
 */
function makePromResponse() {
  return {
    data: {
      data: {
        result: [
          {
            metric: {
              __name__: 'test_metric',
            },
            values: [[1568369640, 1]],
          },
        ],
        resultType: 'matrix',
      },
    },
  };
}
