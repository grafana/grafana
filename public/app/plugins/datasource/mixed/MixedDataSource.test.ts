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

    // Regression for the Cursor Bugbot finding "Done overwrites active streaming state":
    // a delayed finite source's Done must not clear the combined Streaming state while a
    // Live source remains subscribed.
    it('keeps the combined state Streaming when a delayed history Done arrives while a live stream is open', async () => {
      const stream = new Subject<DataQueryResponse>();
      setSrv({
        HIST: new MockDelayedCompletionDataSourceApi('Historical', { data: ['HISTORICAL'] }, 150),
        STREAM: new MockSubjectDataSourceApi('Streaming', stream),
      });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const request = getQueryOptions({
        targets: [
          { refId: 'HIST', datasource: { uid: 'HIST' } },
          { refId: 'STREAM', datasource: { uid: 'STREAM' } },
        ],
      });

      const states: LoadingState[] = [];
      const seriesSnapshots: string[][] = [];
      const subscription = runRequest(ds, request).subscribe((data) => {
        states.push(data.state);
        seriesSnapshots.push((data.series as unknown as string[]).map(String));
      });

      // The datasource promise must resolve before Mixed subscribes to the stream; wait for
      // the subscription deterministically so the first live frame is not lost.
      for (let i = 0; i < 50 && !stream.observed; i++) {
        await flush();
      }
      expect(stream.observed).toBe(true);

      // 5. Live frame arrives first.
      stream.next({ data: ['STREAM-1'], state: LoadingState.Streaming });
      await flush();

      // 6. Combined state is Streaming.
      expect(states[states.length - 1]).toBe(LoadingState.Streaming);

      // 7. The delayed historical datasource emits its Done packet.
      await new Promise((resolve) => setTimeout(resolve, 250));

      // 8. Both frames are retained.
      expect(seriesSnapshots[seriesSnapshots.length - 1]).toEqual(expect.arrayContaining(['STREAM-1', 'HISTORICAL']));

      // 9. State must remain Streaming because the Live subscription is still active.
      expect(states[states.length - 1]).toBe(LoadingState.Streaming);

      // 10. No further live events: the state does not change.
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(states[states.length - 1]).toBe(LoadingState.Streaming);

      // 11. A new live frame replaces the previous streaming frame and keeps both datasets.
      stream.next({ data: ['STREAM-2'], state: LoadingState.Streaming });
      await flush();
      expect(states[states.length - 1]).toBe(LoadingState.Streaming);
      expect(seriesSnapshots[seriesSnapshots.length - 1]).toEqual(expect.arrayContaining(['STREAM-2', 'HISTORICAL']));

      // 12. Cancellation releases the live subscription.
      subscription.unsubscribe();
      expect(stream.observed).toBe(false);
    });
  });

  describe('combined lifecycle states', () => {
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

    const run = (targets: Array<{ refId: string; uid: string }>) => {
      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const request = getQueryOptions({
        targets: targets.map((t) => ({ refId: t.refId, datasource: { uid: t.uid } })),
      });
      const states: LoadingState[] = [];
      const seriesSnapshots: string[][] = [];
      const subscription = runRequest(ds, request).subscribe((data) => {
        states.push(data.state);
        seriesSnapshots.push((data.series as unknown as string[]).map(String));
      });
      return {
        subscription,
        states,
        seriesSnapshots,
        lastState: () => states[states.length - 1],
        lastSeries: () => seriesSnapshots[seriesSnapshots.length - 1],
      };
    };

    const waitForSubscription = async (stream: Subject<DataQueryResponse>) => {
      for (let i = 0; i < 50 && !stream.observed; i++) {
        await flush();
      }
      expect(stream.observed).toBe(true);
    };

    it('renders historical data immediately when the live source has not started', async () => {
      const stream = new Subject<DataQueryResponse>();
      setSrv({
        HIST: new MockObservableDataSourceApi('Historical', [{ data: ['HISTORICAL'] }]),
        STREAM: new MockSubjectDataSourceApi('Streaming', stream),
      });

      const r = run([
        { refId: 'HIST', uid: 'HIST' },
        { refId: 'STREAM', uid: 'STREAM' },
      ]);
      await flush();
      await waitForSubscription(stream);

      // The live source is open but has not reported `Streaming`, so it is not an active
      // stream yet; the completed finite source yields a renderable terminal state.
      expect(r.lastState()).not.toBe(LoadingState.Loading);
      expect(r.lastState()).toBe(LoadingState.Done);
      expect(r.lastSeries()).toContain('HISTORICAL');

      r.subscription.unsubscribe();
      expect(stream.observed).toBe(false);
    });

    it('stays Streaming after a history Done when multiple live sources are open', async () => {
      const stream0 = new Subject<DataQueryResponse>();
      const stream1 = new Subject<DataQueryResponse>();
      setSrv({
        HIST: new MockDelayedCompletionDataSourceApi('Historical', { data: ['HISTORICAL'] }, 150),
        STREAM0: new MockSubjectDataSourceApi('Streaming0', stream0),
        STREAM1: new MockSubjectDataSourceApi('Streaming1', stream1),
      });

      const r = run([
        { refId: 'HIST', uid: 'HIST' },
        { refId: 'S0', uid: 'STREAM0' },
        { refId: 'S1', uid: 'STREAM1' },
      ]);
      await waitForSubscription(stream0);
      await waitForSubscription(stream1);

      stream0.next({ data: ['S0-1'], state: LoadingState.Streaming });
      stream1.next({ data: ['S1-1'], state: LoadingState.Streaming });
      await flush();
      expect(r.lastState()).toBe(LoadingState.Streaming);

      // History resolves while both streams remain open.
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(r.lastState()).toBe(LoadingState.Streaming);
      expect(r.lastSeries()).toEqual(expect.arrayContaining(['S0-1', 'S1-1', 'HISTORICAL']));

      r.subscription.unsubscribe();
      expect(stream0.observed).toBe(false);
      expect(stream1.observed).toBe(false);
    });

    it('does not treat a live source that reports Loading as an active stream', async () => {
      const stream = new Subject<DataQueryResponse>();
      setSrv({ STREAM: new MockSubjectDataSourceApi('Streaming', stream) });

      const r = run([{ refId: 'STREAM', uid: 'STREAM' }]);
      await waitForSubscription(stream);

      stream.next({ data: ['WARMUP'], state: LoadingState.Loading });
      await flush();
      expect(r.lastState()).toBe(LoadingState.Loading);

      stream.next({ data: ['LIVE'], state: LoadingState.Streaming });
      await flush();
      expect(r.lastState()).toBe(LoadingState.Streaming);

      r.subscription.unsubscribe();
      expect(stream.observed).toBe(false);
    });

    it('reports Done when a streaming source genuinely completes', async () => {
      const stream = new Subject<DataQueryResponse>();
      setSrv({
        HIST: new MockObservableDataSourceApi('Historical', [{ data: ['HISTORICAL'] }]),
        STREAM: new MockSubjectDataSourceApi('Streaming', stream),
      });

      const r = run([
        { refId: 'HIST', uid: 'HIST' },
        { refId: 'STREAM', uid: 'STREAM' },
      ]);
      await flush();
      await waitForSubscription(stream);

      stream.next({ data: ['LIVE-1'], state: LoadingState.Streaming });
      await flush();
      expect(r.lastState()).toBe(LoadingState.Streaming);

      // The stream terminates normally; with every source completed the query is done.
      stream.complete();
      await flush();

      expect(r.lastState()).toBe(LoadingState.Done);
      expect(r.lastSeries()).toEqual(expect.arrayContaining(['LIVE-1', 'HISTORICAL']));
    });

    it('completes a finite-only query with terminal Done and all frames retained', async () => {
      setSrv({
        A: new MockObservableDataSourceApi('A', [{ data: ['AAAA'] }]),
        B: new MockObservableDataSourceApi('B', [{ data: ['BBBB'] }]),
      });

      const r = run([
        { refId: 'A', uid: 'A' },
        { refId: 'B', uid: 'B' },
      ]);
      await flush();
      await flush();

      expect(r.lastState()).toBe(LoadingState.Done);
      expect(r.lastSeries()).toEqual(expect.arrayContaining(['AAAA', 'BBBB']));
      r.subscription.unsubscribe();
    });
  });

  describe('subscription isolation (resubscribing the same observable)', () => {
    /**
     * Datasource whose `query()` hands back a fresh `Subject` on every subscription, so two
     * subscribers of the same Mixed observable each get their own independent stream.
     */
    class PerCallSubjectDataSourceApi extends DataSourceApi {
      public readonly streams: Array<Subject<DataQueryResponse>> = [];

      constructor(name: string) {
        super({ name } as DataSourceInstanceSettings);
      }

      query(_request: DataQueryRequest): Observable<DataQueryResponse> {
        const stream = new Subject<DataQueryResponse>();
        this.streams.push(stream);
        return stream.asObservable();
      }

      testDatasource(): Promise<TestDataSourceResponse> {
        return Promise.resolve({ message: '', status: '' });
      }
    }

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

    it('does not leak streaming lifecycle between two subscribers of the same observable', async () => {
      const histDS = new PerCallSubjectDataSourceApi('Historical');
      const streamDS = new PerCallSubjectDataSourceApi('Streaming');
      setSrv({ HIST: histDS, STREAM: streamDS });

      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const request = getQueryOptions({
        targets: [
          { refId: 'HIST', datasource: { uid: 'HIST' } },
          { refId: 'STREAM', datasource: { uid: 'STREAM' } },
        ],
      });

      // ONE Mixed observable, shared by two independent `runRequest` pipelines that each
      // subscribe to it. This is the exact re-subscription shape under investigation: the two
      // subscribers must not share `MixedDatasource.batchQueries` lifecycle bookkeeping.
      const shared = ds.query(request);
      const wrapper = {
        name: 'SharedMixed',
        uid: 'shared-mixed',
        type: 'mixed',
        meta: {},
        query: () => shared,
      } as unknown as DataSourceApi;

      const aStates: LoadingState[] = [];
      const aSeries: string[][] = [];
      const bStates: LoadingState[] = [];
      const bSeries: string[][] = [];
      const subA = runRequest(wrapper, request).subscribe((d) => {
        aStates.push(d.state);
        aSeries.push((d.series as unknown as string[]).map(String));
      });
      const subB = runRequest(wrapper, request).subscribe((d) => {
        bStates.push(d.state);
        bSeries.push((d.series as unknown as string[]).map(String));
      });

      for (let i = 0; i < 10 && (histDS.streams.length < 2 || streamDS.streams.length < 2); i++) {
        await flush();
      }
      // Each subscriber created its own inner streams.
      expect(histDS.streams.length).toBe(2);
      expect(streamDS.streams.length).toBe(2);

      // A is the first subscriber, B the second.
      // 5. Subscriber A receives a Streaming packet.
      streamDS.streams[0].next({ data: ['A-LIVE'], state: LoadingState.Streaming });
      await flush();
      expect(aStates[aStates.length - 1]).toBe(LoadingState.Streaming);

      // 6. Subscriber B receives only a historical Done packet (B never emitted Streaming).
      histDS.streams[1].next({ data: ['B-HIST'], state: LoadingState.Done });
      await flush();

      // 7. Subscriber B must not be influenced by subscriber A's streaming lifecycle.
      expect(bStates[bStates.length - 1]).toBe(LoadingState.Done);
      expect(bSeries[bSeries.length - 1]).toContain('B-HIST');
      expect(bSeries[bSeries.length - 1]).not.toContain('A-LIVE');

      // 8. Subscriber A completes (all of its sources finish); only A closes.
      streamDS.streams[0].complete();
      histDS.streams[0].complete();
      await flush();
      expect(subB.closed).toBe(false);

      // 9. Subscriber B's subsequent frames remain correct. The new packet uses the same
      // response key as B-HIST, so `runRequest` replaces it (that is the documented
      // key-based aggregation), leaving only the freshest frame for that key.
      histDS.streams[1].next({ data: ['B-HIST-2'], state: LoadingState.Done });
      await flush();
      expect(bStates[bStates.length - 1]).toBe(LoadingState.Done);
      expect(bSeries[bSeries.length - 1]).toContain('B-HIST-2');
      expect(bSeries[bSeries.length - 1]).not.toContain('B-HIST');
      expect(bSeries[bSeries.length - 1]).not.toContain('A-LIVE');

      // 10. Subscriber B completes and terminates cleanly.
      histDS.streams[1].complete();
      streamDS.streams[1].complete();
      await flush();
      const bTerminal = bStates[bStates.length - 1];
      expect(bTerminal).toBe(LoadingState.Done);
      expect(subB.closed).toBe(true);

      subA.unsubscribe();
      subB.unsubscribe();
    });
  });
});
