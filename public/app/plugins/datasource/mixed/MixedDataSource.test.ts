import { lastValueFrom } from 'rxjs';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { DatasourceSrvMock, MockObservableDataSourceApi } from 'test/mocks/datasource_srv';

import { DataQueryRequest, DataSourceInstanceSettings, DataSourceRef, dateTime, LoadingState } from '@grafana/data';
import { DataSourceSrv, setDataSourceSrv, setTemplateSrv } from '@grafana/runtime';
import { CustomVariable, SceneFlexLayout, SceneVariableSet } from '@grafana/scenes';

import { TemplateSrv } from '../../../features/templating/template_srv';

import { MixedDatasource, MIXED_DATASOURCE_NAME } from './MixedDataSource';

const defaultDS = new MockObservableDataSourceApi('DefaultDS', [{ data: ['DDD'] }]);
const datasourceSrv = new DatasourceSrvMock(defaultDS, {
  '-- Mixed --': new MockObservableDataSourceApi('mixed'),
  A: new MockObservableDataSourceApi('DSA', [{ data: ['AAAA'] }]),
  B: new MockObservableDataSourceApi('DSB', [{ data: ['BBBB'] }]),
  C: new MockObservableDataSourceApi('DSC', [{ data: ['CCCC'] }]),
  D: new MockObservableDataSourceApi('DSD', [{ data: [] }], undefined, 'syntax error near FROM'),
  E: new MockObservableDataSourceApi('DSE', [{ data: [] }], undefined, 'syntax error near WHERE'),
  Loki: new MockObservableDataSourceApi('Loki', [
    { data: ['A'], key: 'A' },
    { data: ['B'], key: 'B' },
  ]),
});

describe('MixedDatasource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDataSourceSrv({
      ...datasourceSrv,
      get: (uid: DataSourceRef) => datasourceSrv.get(uid),
      getInstanceSettings: jest.fn().mockReturnValue({ meta: {} }),
      getList: jest.fn(),
      reload: jest.fn(),
      registerRuntimeDataSource: jest.fn(),
    });
    setTemplateSrv(new TemplateSrv());
  });

  describe('with no errors', () => {
    it('direct query should return results', async () => {
      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const requestMixed = getQueryOptions({
        targets: [
          { refId: 'QA', datasource: { uid: 'A' } }, // 1
          { refId: 'QB', datasource: { uid: 'B' } }, // 2
          { refId: 'QC', datasource: { uid: 'C' } }, // 3
        ],
      });

      await expect(ds.query(requestMixed)).toEmitValuesWith((results) => {
        expect(results.length).toBe(3);
        expect(results[0].data).toEqual(['AAAA']);
        expect(results[0].state).toEqual(LoadingState.Loading);
        expect(results[1].data).toEqual(['BBBB']);
        expect(results[2].data).toEqual(['CCCC']);
        expect(results[2].state).toEqual(LoadingState.Done);
      });
    });
  });

  describe('with errors', () => {
    it('direct query should return results', async () => {
      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const requestMixed = getQueryOptions({
        targets: [
          { refId: 'QA', datasource: { uid: 'A' } }, // 1
          { refId: 'QD', datasource: { uid: 'D' } }, // 2
          { refId: 'QB', datasource: { uid: 'B' } }, // 3
          { refId: 'QE', datasource: { uid: 'E' } }, // 4
          { refId: 'QC', datasource: { uid: 'C' } }, // 5
        ],
      });

      await expect(ds.query(requestMixed)).toEmitValuesWith((results) => {
        expect(results[0].data).toEqual(['AAAA']);
        expect(results[0].state).toEqual(LoadingState.Loading);
        expect(results[1].data).toEqual([]);
        expect(results[1].state).toEqual(LoadingState.Error);
        expect(results[1].error).toEqual({ message: 'DSD: syntax error near FROM' });
        expect(results[2].data).toEqual(['BBBB']);
        expect(results[2].state).toEqual(LoadingState.Loading);
        expect(results[3].data).toEqual([]);
        expect(results[3].state).toEqual(LoadingState.Error);
        expect(results[3].error).toEqual({ message: 'DSE: syntax error near WHERE' });
        expect(results[4].data).toEqual(['CCCC']);
        expect(results[4].state).toEqual(LoadingState.Loading);
        expect(results[5].data).toEqual([]);
        expect(results[5].state).toEqual(LoadingState.Error);
        expect(results[5].error).toEqual({ message: 'DSD: syntax error near FROM' });
      });
    });
  });

  describe('with multi template variable', () => {
    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings() {
          return {};
        },
      } as DataSourceSrv);
    });

    const scene = new SceneFlexLayout({
      children: [],
      $variables: new SceneVariableSet({
        variables: [new CustomVariable({ name: 'ds', value: ['B', 'C'] })],
      }),
    });

    it('should run query for each datasource when there is a multi value template variable', async () => {
      const ds = new MixedDatasource({} as DataSourceInstanceSettings);

      const request = {
        targets: [{ refId: 'AA', datasource: { uid: '$ds' } }],
        scopedVars: {
          __sceneObject: { value: scene },
        },
      } as unknown as DataQueryRequest;

      await expect(ds.query(request)).toEmitValuesWith((results) => {
        expect(results).toHaveLength(2);
        expect(results[0].key).toBe('mixed-0-');
        expect(results[0].state).toBe(LoadingState.Loading);
        expect(results[1].key).toBe('mixed-1-');
        expect(results[1].state).toBe(LoadingState.Done);
      });
    });

    it('should run query for picked datasource and template variable datasource', async () => {
      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const request = {
        targets: [
          { refId: 'AA', datasource: { uid: '$ds' } },
          { refId: 'BB', datasource: { uid: 'Loki' } },
        ],
        scopedVars: {
          __sceneObject: { value: scene },
        },
      } as unknown as DataQueryRequest;

      await expect(ds.query(request)).toEmitValuesWith((results) => {
        expect(results).toHaveLength(4);
        expect(results[0].key).toBe('mixed-0-');
        expect(results[0].state).toBe(LoadingState.Loading);
        expect(results[1].key).toBe('mixed-1-');
        expect(results[1].state).toBe(LoadingState.Loading);
        expect(results[2].key).toBe('mixed-2-A');
        expect(results[2].state).toBe(LoadingState.Loading);
        expect(results[3].key).toBe('mixed-2-B');
        expect(results[3].state).toBe(LoadingState.Done);
      });
    });
  });

  describe('with single value template variable', () => {
    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings() {
          return {};
        },
      } as DataSourceSrv);
    });

    const scene = new SceneFlexLayout({
      children: [],
      $variables: new SceneVariableSet({
        variables: [new CustomVariable({ name: 'ds', value: 'B' })],
      }),
    });

    it('should run query for correct datasource', async () => {
      const ds = new MixedDatasource({} as DataSourceInstanceSettings);

      const request = {
        targets: [{ refId: 'AA', datasource: { uid: '$ds' } }],
        scopedVars: {
          __sceneObject: { value: scene },
        },
      } as unknown as DataQueryRequest;

      await expect(ds.query(request)).toEmitValuesWith((results) => {
        expect(results).toHaveLength(1);
        expect(results[0].data).toEqual(['BBBB']);
      });
    });
  });

  it('should return both query results from the same data source', async () => {
    const ds = new MixedDatasource({} as DataSourceInstanceSettings);
    const request = {
      targets: [
        { refId: 'A', datasource: { uid: 'Loki' } },
        { refId: 'B', datasource: { uid: 'Loki' } },
        { refId: 'C', datasource: { uid: 'A' } },
      ],
    } as DataQueryRequest;

    await expect(ds.query(request)).toEmitValuesWith((results) => {
      expect(results).toHaveLength(3);
      expect(results[0].key).toBe('mixed-0-A');
      expect(results[1].key).toBe('mixed-0-B');
      expect(results[1].state).toBe(LoadingState.Loading);
      expect(results[2].key).toBe('mixed-1-');
      expect(results[2].state).toBe(LoadingState.Done);
    });
  });

  it('should not return the error for the second time', async () => {
    const ds = new MixedDatasource({} as DataSourceInstanceSettings);
    const request = {
      targets: [
        { refId: 'A', datasource: 'Loki' },
        { refId: 'DD', datasource: 'D' },
        { refId: 'C', datasource: 'A' },
      ],
    } as unknown as DataQueryRequest;

    await lastValueFrom(ds.query(request));

    await expect(
      ds.query({
        targets: [
          { refId: 'QA', datasource: { uid: 'A' } },
          { refId: 'QB', datasource: { uid: 'B' } },
        ],
      } as DataQueryRequest)
    ).toEmitValuesWith((results) => {
      expect(results).toHaveLength(2);
      expect(results[0].key).toBe('mixed-0-');
      expect(results[1].key).toBe('mixed-1-');
      expect(results[1].state).toBe(LoadingState.Done);
    });
  });

  it('should filter out MixedDataSource queries', async () => {
    const ds = new MixedDatasource({} as DataSourceInstanceSettings);

    await expect(
      ds.query({
        targets: [{ refId: 'A', datasource: { uid: MIXED_DATASOURCE_NAME, id: 'datasource' } }],
      } as unknown as DataQueryRequest)
    ).toEmitValuesWith((results) => {
      expect(results).toHaveLength(1);
      expect(results[0].data).toHaveLength(0);
    });
  });

  describe('sub-datasource interval handling', () => {
    it('should respect sub-datasource interval when it produces a larger intervalMs', async () => {
      const promDS = new MockObservableDataSourceApi('Prometheus', [{ data: ['prom-data'] }]);
      promDS.interval = '1m';
      const querySpy = jest.spyOn(promDS, 'query');

      const noIntervalDS = new MockObservableDataSourceApi('NoInterval', [{ data: ['other-data'] }]);
      const noIntervalSpy = jest.spyOn(noIntervalDS, 'query');

      setDataSourceSrv({
        ...datasourceSrv,
        get: (ref: DataSourceRef) => {
          const uid = typeof ref === 'string' ? ref : ref?.uid;
          if (uid === 'prom') {
            return Promise.resolve(promDS);
          }
          if (uid === 'other') {
            return Promise.resolve(noIntervalDS);
          }
          return datasourceSrv.get(ref);
        },
        getInstanceSettings: jest.fn().mockReturnValue({ meta: {} }),
        getList: jest.fn(),
        reload: jest.fn(),
        registerRuntimeDataSource: jest.fn(),
      } as unknown as DataSourceSrv);

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const now = dateTime();
      const request = getQueryOptions({
        targets: [
          { refId: 'QA', datasource: { uid: 'prom' } },
          { refId: 'QB', datasource: { uid: 'other' } },
        ],
        range: { from: now.subtract(1, 'hour'), to: now, raw: { from: 'now-1h', to: 'now' } },
        maxDataPoints: 500,
        interval: '5s',
        intervalMs: 5000,
      });

      await expect(ds.query(request)).toEmitValuesWith((results) => {
        expect(results).toHaveLength(2);
      });

      const promRequest = querySpy.mock.calls[0][0];
      expect(promRequest.intervalMs).toBeGreaterThanOrEqual(60000);
      expect(promRequest.scopedVars.__interval_ms?.value).toBe(promRequest.intervalMs);

      const otherRequest = noIntervalSpy.mock.calls[0][0];
      expect(otherRequest.intervalMs).toBe(5000);
    });

    it('should keep panel minInterval when it is larger than sub-datasource interval', async () => {
      const promDS = new MockObservableDataSourceApi('Prometheus', [{ data: ['prom-data'] }]);
      promDS.interval = '30s';
      const querySpy = jest.spyOn(promDS, 'query');

      setDataSourceSrv({
        ...datasourceSrv,
        get: (ref: DataSourceRef) => {
          const uid = typeof ref === 'string' ? ref : ref?.uid;
          if (uid === 'prom') {
            return Promise.resolve(promDS);
          }
          return datasourceSrv.get(ref);
        },
        getInstanceSettings: jest.fn().mockReturnValue({ meta: {} }),
        getList: jest.fn(),
        reload: jest.fn(),
        registerRuntimeDataSource: jest.fn(),
      } as unknown as DataSourceSrv);

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const request = getQueryOptions({
        targets: [{ refId: 'QA', datasource: { uid: 'prom' } }],
        interval: '2m',
        intervalMs: 120000,
      });

      await expect(ds.query(request)).toEmitValuesWith((results) => {
        expect(results).toHaveLength(1);
      });

      const promRequest = querySpy.mock.calls[0][0];
      expect(promRequest.intervalMs).toBe(120000);
      expect(promRequest.interval).toBe('2m');
    });
  });
});
