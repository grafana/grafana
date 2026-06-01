import { of } from 'rxjs';
import { take } from 'rxjs/operators';

import { LiveChannelScope, LoadingState, type DataQueryResponse, type DataQueryRequest, dateTime } from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';

import type DockerDatasource from './datasource';
import { doDockerChannelStream } from './streaming';
import type { DockerQuery } from './types';

jest.mock('@grafana/runtime', () => ({
  getGrafanaLiveSrv: jest.fn(),
}));

interface LiveChannelArgs {
  scope: LiveChannelScope;
  stream: string;
  path: string;
  data: {
    containerId: string;
    timeRange: {
      from: number;
      to: number;
      maxDataPoints: number;
    };
  };
}

describe('doDockerChannelStream', () => {
  const mockStreamFn = jest.fn();

  const query: DockerQuery = {
    containerId: 'cpu',
    resourceType: 'container_stats',
    refId: 'A',
    hide: false,
    streaming: false,
  };

  const ds = {
    uid: 'docker-uid',
  } as DockerDatasource;

  const options: DataQueryRequest<DockerQuery> = {
    targets: [query],
    requestId: 'test',
    interval: '',
    intervalMs: 0,
    range: {
      from: dateTime(0),
      to: dateTime(1000),
      raw: { from: 'now-1h', to: 'now' },
    },
    scopedVars: {},
    startTime: 0,
    timezone: 'browser',
    app: 'test',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (getGrafanaLiveSrv as jest.Mock).mockReturnValue({
      getStream: mockStreamFn,
    });
  });

  it('subscribes to correct live channel', (done) => {
    mockStreamFn.mockReturnValue(
      of({
        message: {
          schema: {
            fields: [{ name: 'read' }, { name: 'cpu_stats' }],
          },
          data: [[1000, {}]],
        },
      })
    );

    doDockerChannelStream(query, ds, options)
      .pipe(take(1))
      .subscribe({
        next: () => {
          expect(mockStreamFn).toHaveBeenCalledTimes(1);

          const call = mockStreamFn.mock.calls[0][0] as LiveChannelArgs;

          expect(call.scope).toBe(LiveChannelScope.DataSource);
          expect(call.stream).toBe('docker-uid');

          expect(call.path).toBe('stats/cpu');

          expect(call.data.containerId).toBe('cpu');
          expect(call.data.timeRange).toBeDefined();

          done();
        },
        error: done,
      });
  });

  it('emits streaming responses with frames', (done) => {
    mockStreamFn.mockReturnValue(
      of(
        {
          message: {
            schema: { fields: [{ name: 'a' }] },
            data: [[1]],
          },
        },
        {
          message: {
            schema: { fields: [{ name: 'b' }] },
            data: [[2]],
          },
        }
      )
    );

    const results: DataQueryResponse[] = [];

    doDockerChannelStream(query, ds, options)
      .pipe(take(2))
      .subscribe({
        next: (resp) => {
          expect(resp.state).toBe(LoadingState.Streaming);
          expect(Array.isArray(resp.data)).toBe(true);

          results.push(resp);
        },
        complete: () => {
          expect(results.length).toBe(2);

          expect(results[0].data.length).toBeGreaterThanOrEqual(0);
          expect(results[1].data.length).toBeGreaterThanOrEqual(0);

          done();
        },
        error: done,
      });
  });

  it('ignores null messages without crashing', (done) => {
    mockStreamFn.mockReturnValue(
      of(
        { message: null },
        {
          message: {
            schema: { fields: [{ name: 'x' }] },
            data: [[123]],
          },
        }
      )
    );

    const results: DataQueryResponse[] = [];

    doDockerChannelStream(query, ds, options)
      .pipe(take(2))
      .subscribe({
        next: (resp) => {
          expect(resp.state).toBe(LoadingState.Streaming);
          expect(Array.isArray(resp.data)).toBe(true);
          results.push(resp);
        },
        complete: () => {
          expect(results.length).toBe(2);

          expect(results[0].data.length).toBe(0);

          expect(results[1].data.length).toBeGreaterThanOrEqual(0);

          done();
        },
        error: done,
      });
  });

  it('calls grafana live service with correct stream path', (done) => {
    const spy = jest.fn();

    mockStreamFn.mockReturnValue(
      of({
        message: {
          schema: { fields: [{ name: 'x' }] },
          data: [[1]],
        },
      })
    );

    (getGrafanaLiveSrv as jest.Mock).mockReturnValue({
      getStream: (args: LiveChannelArgs) => {
        spy(args);
        return mockStreamFn();
      },
    });

    doDockerChannelStream(query, ds, options)
      .pipe(take(1))
      .subscribe({
        next: () => {
          expect(spy).toHaveBeenCalledTimes(1);

          const call = spy.mock.calls[0][0] as LiveChannelArgs;

          expect(call.scope).toBe(LiveChannelScope.DataSource);
          expect(call.stream).toBe('docker-uid');
          expect(call.path).toBe('stats/cpu');

          done();
        },
        error: done,
      });
  });
});
