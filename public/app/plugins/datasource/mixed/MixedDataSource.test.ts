import { lastValueFrom, type Observable, of } from 'rxjs';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { DatasourceSrvMock, MockObservableDataSourceApi } from 'test/mocks/datasource_srv';

import {
  type DataQueryRequest,
  type DataQueryResponse,
  DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourceRef,
  getDataSourceUID,
  LoadingState,
} from '@grafana/data';
import { type DataSourceSrv, setDataSourceSrv, setTemplateSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
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

class RecordingExpressionDatasource extends DataSourceApi {
  requests: DataQueryRequest[] = [];

  constructor() {
    super({ name: 'Expression' } as DataSourceInstanceSettings);
  }

  query(request: DataQueryRequest): Observable<DataQueryResponse> {
    this.requests.push(request);
    return of({ data: [] });
  }

  testDatasource() {
    return Promise.resolve({ message: '', status: '' });
  }
}

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

  describe('with expressions', () => {
    const multiScene = new SceneFlexLayout({
      children: [],
      $variables: new SceneVariableSet({
        variables: [new CustomVariable({ name: 'ds', value: ['B', 'C'] })],
      }),
    });

    let expressionDS: RecordingExpressionDatasource;

    beforeEach(() => {
      expressionDS = new RecordingExpressionDatasource();
      setDataSourceSrv({
        ...datasourceSrv,
        get: (ref: DataSourceRef) => {
          if (getDataSourceUID(ref) === ExpressionDatasourceRef.uid) {
            return Promise.resolve(expressionDS);
          }
          return datasourceSrv.get(ref);
        },
        getInstanceSettings: jest.fn().mockReturnValue({ meta: {} }),
        getList: jest.fn(),
        reload: jest.fn(),
        registerRuntimeDataSource: jest.fn(),
      } as DataSourceSrv);
      setTemplateSrv(new TemplateSrv());
    });

    it('fans the whole query graph out to the expression datasource once per selected datasource', async () => {
      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const request = {
        targets: [
          { refId: 'A', datasource: { uid: '$ds' }, hide: true },
          { refId: 'B', datasource: ExpressionDatasourceRef, type: 'math', expression: '$A' },
        ],
        scopedVars: { __sceneObject: { value: multiScene } },
      } as unknown as DataQueryRequest;

      await lastValueFrom(ds.query(request));

      // one expression request per selected datasource
      expect(expressionDS.requests).toHaveLength(2);
      // each carries the data query AND the expression query
      for (const req of expressionDS.requests) {
        expect(req.targets.map((t) => t.refId).sort()).toEqual(['A', 'B']);
      }
      // the multi value variable is pinned to a distinct datasource per request
      expect(expressionDS.requests.map((r) => r.scopedVars?.ds?.value)).toEqual(['B', 'C']);
    });

    it('emits one namespaced result per selected datasource', async () => {
      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const request = {
        targets: [
          { refId: 'A', datasource: { uid: '$ds' }, hide: true },
          { refId: 'B', datasource: ExpressionDatasourceRef, type: 'math', expression: '$A' },
        ],
        scopedVars: { __sceneObject: { value: multiScene } },
      } as unknown as DataQueryRequest;

      await expect(ds.query(request)).toEmitValuesWith((results) => {
        expect(results).toHaveLength(2);
        expect(results[0].key).toBe('mixed-0-');
        expect(results[1].key).toBe('mixed-1-');
        expect(results[1].state).toBe(LoadingState.Done);
      });
    });

    it('errors when a multi value datasource variable is mixed with other datasources in an expression', async () => {
      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const request = {
        targets: [
          { refId: 'A', datasource: { uid: '$ds' }, hide: true },
          { refId: 'C', datasource: { uid: 'A' }, hide: true },
          { refId: 'B', datasource: ExpressionDatasourceRef, type: 'math', expression: '$C' },
        ],
        scopedVars: { __sceneObject: { value: multiScene } },
      } as unknown as DataQueryRequest;

      await expect(ds.query(request)).toEmitValuesWith((results) => {
        expect(results).toHaveLength(1);
        expect(results[0].state).toBe(LoadingState.Error);
        expect(results[0].error?.message).toContain('not supported');
      });
      // no requests should have been dispatched
      expect(expressionDS.requests).toHaveLength(0);
    });

    it('sends a single expression request when no multi value datasource variable is used', async () => {
      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const request = {
        targets: [
          { refId: 'A', datasource: { uid: 'A' } },
          { refId: 'C', datasource: { uid: 'C' } },
          { refId: 'B', datasource: ExpressionDatasourceRef, type: 'math', expression: '$A + $C' },
        ],
      } as unknown as DataQueryRequest;

      await lastValueFrom(ds.query(request));

      // expression still gets all of its inputs in a single request (no per-uid split)
      expect(expressionDS.requests).toHaveLength(1);
      expect(expressionDS.requests[0].targets.map((t) => t.refId).sort()).toEqual(['A', 'B', 'C']);
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
});
