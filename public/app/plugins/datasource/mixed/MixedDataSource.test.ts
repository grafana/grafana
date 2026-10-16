import { lastValueFrom, Observable, Subject } from 'rxjs';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { DatasourceSrvMock, MockObservableDataSourceApi } from 'test/mocks/datasource_srv';

import {
  DataSourceApi,
  type DataQueryRequest,
  type DataQueryResponse,
  type DataSourceInstanceSettings,
  type DataSourceRef,
  type PanelData,
  type TestDataSourceResponse,
  LoadingState,
} from '@grafana/data';
import { type DataSourceSrv, setDataSourceSrv, setEchoSrv, setTemplateSrv } from '@grafana/runtime';
import { CustomVariable, SceneFlexLayout, SceneVariableSet } from '@grafana/scenes';

import { Echo } from '../../../core/services/echo/Echo';
import { runRequest } from '../../../features/query/state/runRequest';
import { TemplateSrv } from '../../../features/templating/template_srv';

import { MixedDatasource, MIXED_DATASOURCE_NAME } from './MixedDataSource';

jest.mock('app/core/services/backend_srv');

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

/**
 * Test-only datasource that emits the given responses and then intentionally never
 * completes, emulating a continuous streaming datasource (e.g. a Loki live/stream query).
 * Like a real streaming source it emits `LoadingState.Streaming` frames.
 */
class MockNeverCompletingDataSourceApi extends DataSourceApi {
  constructor(
    name: string,
    private emissions: DataQueryResponse[]
  ) {
    super({ name } as DataSourceInstanceSettings);
  }

  query(_request: DataQueryRequest): Observable<DataQueryResponse> {
    return new Observable<DataQueryResponse>((observer) => {
      this.emissions.forEach((response) => observer.next(response));
      // Deliberately never calls observer.complete()
    });
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ message: '', status: '' });
  }
}

/**
 * Test-only datasource backed by a `Subject`, so a test can push responses at arbitrary
 * times (including long after subscription) and observe whether it is still subscribed.
 * Like a real streaming datasource it never completes on its own.
 */
class MockSubjectDataSourceApi extends DataSourceApi {
  constructor(
    name: string,
    public readonly stream: Subject<DataQueryResponse>
  ) {
    super({ name } as DataSourceInstanceSettings);
  }

  query(_request: DataQueryRequest): Observable<DataQueryResponse> {
    return this.stream.asObservable();
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ message: '', status: '' });
  }
}

/**
 * Test-only finite datasource that emits a single response after a delay and only then
 * completes, emulating a datasource whose data arrives in a later macrotask than the
 * others.
 */
class MockDelayedCompletionDataSourceApi extends DataSourceApi {
  constructor(
    name: string,
    private readonly response: DataQueryResponse,
    private readonly emissionDelayMs: number
  ) {
    super({ name } as DataSourceInstanceSettings);
  }

  query(_request: DataQueryRequest): Observable<DataQueryResponse> {
    return new Observable<DataQueryResponse>((observer) => {
      const timer = setTimeout(() => {
        observer.next(this.response);
        observer.complete();
      }, this.emissionDelayMs);
      return () => clearTimeout(timer);
    });
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ message: '', status: '' });
  }
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

describe('MixedDatasource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setEchoSrv(new Echo());
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
        // Each finite source resolves on its own, so every packet carries a terminal state
        // the panel can render instead of being held at `Loading` until all sources finish.
        expect(results[0].state).toEqual(LoadingState.Done);
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
        // Failed sources emit their own error packet alongside the healthy data; the error is
        // no longer duplicated as a trailing packet because the aggregation in `runRequest`
        // already surfaces an error state to the panel.
        expect(results).toHaveLength(5);
        expect(results[0].data).toEqual(['AAAA']);
        expect(results[0].state).toEqual(LoadingState.Done);
        expect(results[1].data).toEqual([]);
        expect(results[1].state).toEqual(LoadingState.Error);
        expect(results[1].error).toEqual({ message: 'DSD: syntax error near FROM' });
        expect(results[2].data).toEqual(['BBBB']);
        expect(results[2].state).toEqual(LoadingState.Done);
        expect(results[3].data).toEqual([]);
        expect(results[3].state).toEqual(LoadingState.Error);
        expect(results[3].error).toEqual({ message: 'DSE: syntax error near WHERE' });
        expect(results[4].data).toEqual(['CCCC']);
        expect(results[4].state).toEqual(LoadingState.Done);
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
        expect(results[0].state).toBe(LoadingState.Done);
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
        expect(results[0].state).toBe(LoadingState.Done);
        expect(results[1].key).toBe('mixed-1-');
        expect(results[1].state).toBe(LoadingState.Done);
        expect(results[2].key).toBe('mixed-2-A');
        expect(results[2].state).toBe(LoadingState.Done);
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
      expect(results[1].state).toBe(LoadingState.Done);
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

  describe('finite and streaming datasources', () => {
    const setSrv = (datasources: Record<string, DataSourceApi>) => {
      const srv = new DatasourceSrvMock(new MockObservableDataSourceApi('DefaultDS'), datasources);
      setDataSourceSrv({
        ...srv,
        get: (uid: DataSourceRef) => srv.get(uid),
        getInstanceSettings: jest.fn().mockReturnValue({ meta: {} }),
        getList: jest.fn(),
        reload: jest.fn(),
        registerRuntimeDataSource: jest.fn(),
      } as unknown as DataSourceSrv);
    };

    const mixedRequest = () =>
      getQueryOptions({
        targets: [
          { refId: 'HIST', datasource: { uid: 'HIST' } },
          { refId: 'STREAM', datasource: { uid: 'STREAM' } },
        ],
      });

    it('surfaces historical and streaming data without waiting for the stream to terminate', async () => {
      setSrv({
        HIST: new MockObservableDataSourceApi('Historical', [{ data: ['HISTORICAL'] }]),
        STREAM: new MockNeverCompletingDataSourceApi('Streaming', [
          { data: ['STREAM-1'], state: LoadingState.Streaming },
        ]),
      });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const received: DataQueryResponse[] = [];
      const subscription = ds.query(mixedRequest()).subscribe((response) => received.push(response));

      await flush();
      subscription.unsubscribe();

      const history = received.find((r) => r.data?.[0] === 'HISTORICAL');
      const streamed = received.find((r) => r.data?.[0] === 'STREAM-1');
      expect(history).toBeDefined();
      // Historical data is terminal (renderable) even though the stream is still open.
      expect(history?.state).toBe(LoadingState.Done);
      expect(streamed?.state).toBe(LoadingState.Streaming);
    });

    it('returns both datasets when the stream emits before the history resolves', async () => {
      const stream = new Subject<DataQueryResponse>();
      setSrv({
        HIST: new MockDelayedCompletionDataSourceApi('Historical', { data: ['HISTORICAL'] }, 150),
        STREAM: new MockSubjectDataSourceApi('Streaming', stream),
      });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const received: DataQueryResponse[] = [];
      const subscription = ds.query(mixedRequest()).subscribe((response) => received.push(response));

      await flush();
      stream.next({ data: ['STREAM-FIRST'], state: LoadingState.Streaming });
      await flush();

      // The stream's early frame is available before the finite source resolves.
      expect(received.map((r) => r.data?.[0])).toEqual(['STREAM-FIRST']);

      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(received.map((r) => r.data?.[0])).toEqual(expect.arrayContaining(['STREAM-FIRST', 'HISTORICAL']));

      subscription.unsubscribe();
    });

    it('does not wait for a delayed first streaming emission before surfacing historical data', async () => {
      const stream = new Subject<DataQueryResponse>();
      setSrv({
        HIST: new MockObservableDataSourceApi('Historical', [{ data: ['HISTORICAL'] }]),
        STREAM: new MockSubjectDataSourceApi('Streaming', stream),
      });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const received: DataQueryResponse[] = [];
      const subscription = ds.query(mixedRequest()).subscribe((response) => received.push(response));

      // The streaming datasource has not emitted anything yet.
      await flush();
      expect(received.map((r) => r.data?.[0])).toEqual(['HISTORICAL']);

      stream.next({ data: ['STREAM-LATE'], state: LoadingState.Streaming });
      await flush();
      expect(received.map((r) => r.data?.[0])).toEqual(['HISTORICAL', 'STREAM-LATE']);

      subscription.unsubscribe();
    });

    it('forwards frames from multiple continuous streams and keeps them streaming', async () => {
      const stream0 = new Subject<DataQueryResponse>();
      const stream1 = new Subject<DataQueryResponse>();
      setSrv({
        STREAM0: new MockSubjectDataSourceApi('Streaming0', stream0),
        STREAM1: new MockSubjectDataSourceApi('Streaming1', stream1),
      });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const received: DataQueryResponse[] = [];
      const subscription = ds
        .query(
          getQueryOptions({
            targets: [
              { refId: 'S0', datasource: { uid: 'STREAM0' } },
              { refId: 'S1', datasource: { uid: 'STREAM1' } },
            ],
          })
        )
        .subscribe((response) => received.push(response));

      // Wait for the datasources to resolve and subscribe before pushing frames.
      await flush();
      stream0.next({ data: ['S0-1'], state: LoadingState.Streaming });
      stream1.next({ data: ['S1-1'], state: LoadingState.Streaming });
      await flush();

      expect(received.map((r) => r.data?.[0])).toEqual(expect.arrayContaining(['S0-1', 'S1-1']));
      // Neither stream has completed, so every frame must stay streaming (never Loading,
      // which would hide the data, and never Done, which would imply completion).
      expect(received.every((r) => r.state === LoadingState.Streaming)).toBe(true);

      subscription.unsubscribe();
      expect(stream0.observed).toBe(false);
      expect(stream1.observed).toBe(false);
    });

    it('isolates a streaming error while still emitting the historical data', async () => {
      const stream = new Subject<DataQueryResponse>();
      setSrv({
        HIST: new MockObservableDataSourceApi('Historical', [{ data: ['HISTORICAL'] }]),
        STREAM: new MockSubjectDataSourceApi('Streaming', stream),
      });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const received: DataQueryResponse[] = [];
      const subscription = ds.query(mixedRequest()).subscribe((response) => received.push(response));

      await flush();
      stream.error(new Error('stream failed'));
      await flush();
      subscription.unsubscribe();

      expect(received.some((r) => r.data?.[0] === 'HISTORICAL')).toBe(true);
      const error = received.find((r) => r.state === LoadingState.Error);
      expect(error?.error?.message).toBe('Streaming: stream failed');
    });

    it('keeps a healthy stream running when a finite datasource errors', async () => {
      const stream = new Subject<DataQueryResponse>();
      setSrv({
        BROKEN: new MockObservableDataSourceApi('Broken', undefined, undefined, 'boom'),
        STREAM: new MockSubjectDataSourceApi('Streaming', stream),
      });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const received: DataQueryResponse[] = [];
      const subscription = ds
        .query(
          getQueryOptions({
            targets: [
              { refId: 'BROKEN', datasource: { uid: 'BROKEN' } },
              { refId: 'STREAM', datasource: { uid: 'STREAM' } },
            ],
          })
        )
        .subscribe((response) => received.push(response));

      await flush();
      const error = received.find((r) => r.state === LoadingState.Error);
      expect(error?.error?.message).toBe('Broken: boom');

      stream.next({ data: ['STREAM-AFTER-ERROR'], state: LoadingState.Streaming });
      await flush();

      expect(received.some((r) => r.data?.[0] === 'STREAM-AFTER-ERROR')).toBe(true);
      // The failing source must not have torn down the streaming subscription.
      expect(stream.observed).toBe(true);

      subscription.unsubscribe();
      expect(stream.observed).toBe(false);
    });

    it('unsubscribes from the streaming source when the mixed subscription is cancelled', async () => {
      const stream = new Subject<DataQueryResponse>();
      setSrv({
        HIST: new MockObservableDataSourceApi('Historical', [{ data: ['HISTORICAL'] }]),
        STREAM: new MockSubjectDataSourceApi('Streaming', stream),
      });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const subscription = ds.query(mixedRequest()).subscribe(() => {});

      await flush();
      expect(stream.observed).toBe(true);

      subscription.unsubscribe();
      expect(stream.observed).toBe(false);
    });

    it('cleans up the previous subscription when the query is re-run', async () => {
      const firstStream = new Subject<DataQueryResponse>();
      setSrv({
        HIST: new MockObservableDataSourceApi('Historical', [{ data: ['HISTORICAL'] }]),
        STREAM: new MockSubjectDataSourceApi('Streaming', firstStream),
      });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);

      const first = ds.query(mixedRequest()).subscribe(() => {});
      await flush();
      expect(firstStream.observed).toBe(true);

      // A refresh starts a new query and tears the old one down.
      first.unsubscribe();
      const secondStream = new Subject<DataQueryResponse>();
      setSrv({
        HIST: new MockObservableDataSourceApi('Historical', [{ data: ['HISTORICAL'] }]),
        STREAM: new MockSubjectDataSourceApi('Streaming', secondStream),
      });
      const second = ds.query(mixedRequest()).subscribe(() => {});
      await flush();

      expect(firstStream.observed).toBe(false);
      expect(secondStream.observed).toBe(true);

      second.unsubscribe();
      expect(secondStream.observed).toBe(false);
    });

    it('keeps response keys stable and does not accumulate across repeated stream updates', async () => {
      const stream = new Subject<DataQueryResponse>();
      setSrv({
        HIST: new MockObservableDataSourceApi('Historical', [{ data: ['HISTORICAL'] }]),
        STREAM: new MockSubjectDataSourceApi('Streaming', stream),
      });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const received: DataQueryResponse[] = [];
      const subscription = ds.query(mixedRequest()).subscribe((response) => received.push(response));

      await flush();

      const updates = 50;
      for (let i = 0; i < updates; i++) {
        stream.next({ data: [`STREAM-${i}`], state: LoadingState.Streaming });
      }
      await flush();
      subscription.unsubscribe();

      const streamingResponses = received.filter((r) => r.data?.[0] !== 'HISTORICAL');
      // One forwarded packet per emission — no buffering or batching accumulates frames.
      expect(streamingResponses).toHaveLength(updates);
      // Every streaming frame shares the single stable key for that batch, so `runRequest`
      // replaces rather than appends packets.
      expect(new Set(streamingResponses.map((r) => r.key))).toEqual(new Set(['mixed-1-']));
    });
  });

  describe('downstream response lifecycle', () => {
    const setSrv = (datasources: Record<string, DataSourceApi>) => {
      const srv = new DatasourceSrvMock(new MockObservableDataSourceApi('DefaultDS'), datasources);
      setDataSourceSrv({
        ...srv,
        get: (uid: DataSourceRef) => srv.get(uid),
        getInstanceSettings: jest.fn().mockReturnValue({ meta: {} }),
        getList: jest.fn(),
        reload: jest.fn(),
        registerRuntimeDataSource: jest.fn(),
      } as unknown as DataSourceSrv);
    };

    it('makes historical frames displayable while a live stream stays open', async () => {
      const stream = new Subject<DataQueryResponse>();
      setSrv({
        HIST: new MockObservableDataSourceApi('Historical', [{ data: ['HISTORICAL'] }]),
        STREAM: new MockSubjectDataSourceApi('Streaming', stream),
      });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const request = getQueryOptions({
        targets: [
          { refId: 'HIST', datasource: { uid: 'HIST' } },
          { refId: 'STREAM', datasource: { uid: 'STREAM' } },
        ],
      });

      const panelData: PanelData[] = [];
      // SceneQueryRunner only renders a panel once it has carried non-loading data
      // (`_hasFetchedData`). Mirror that gate here to prove the mixed response is renderable
      // while the stream is still open.
      let hasFetchedData = false;
      const subscription = runRequest(ds, request).subscribe((data) => {
        if (data.state !== LoadingState.Loading) {
          hasFetchedData = true;
        }
        panelData.push(data);
      });

      await flush();

      expect(hasFetchedData).toBe(true);
      const latest = panelData[panelData.length - 1];
      expect(latest.state).not.toBe(LoadingState.Loading);
      expect(latest.series).toContain('HISTORICAL');

      // The stream keeps updating after the history completed, retaining the earlier frames.
      stream.next({ data: ['STREAM-1'], state: LoadingState.Streaming });
      await flush();

      const afterStream = panelData[panelData.length - 1];
      expect(afterStream.state).toBe(LoadingState.Streaming);
      expect(afterStream.series).toEqual(expect.arrayContaining(['HISTORICAL', 'STREAM-1']));

      subscription.unsubscribe();
      expect(stream.observed).toBe(false);
    });

    it('reports an error without discarding a healthy source in the aggregated panel data', async () => {
      setSrv({
        BROKEN: new MockObservableDataSourceApi('Broken', undefined, undefined, 'boom'),
        HEALTHY: new MockObservableDataSourceApi('Healthy', [{ data: ['HEALTHY'] }]),
      });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const request = getQueryOptions({
        targets: [
          { refId: 'BROKEN', datasource: { uid: 'BROKEN' } },
          { refId: 'HEALTHY', datasource: { uid: 'HEALTHY' } },
        ],
      });

      const panelData: PanelData[] = [];
      const subscription = runRequest(ds, request).subscribe((data) => panelData.push(data));
      await flush();
      subscription.unsubscribe();

      const latest = panelData[panelData.length - 1];
      expect(latest.state).toBe(LoadingState.Error);
      expect(latest.error?.message).toBe('Broken: boom');
      // The successful datasource's frame survives the failure of the other.
      expect(latest.series).toContain('HEALTHY');
    });
  });
});
