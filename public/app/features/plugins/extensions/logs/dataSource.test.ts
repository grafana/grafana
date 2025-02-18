import { nanoid } from 'nanoid';
import { lastValueFrom, of } from 'rxjs';

import { DataQueryRequest, dateTime, LoadingState } from '@grafana/data';

import { ExtensionsLogDataSource } from './dataSource';
import { log } from './log';

jest.mock('./log', () => {
  const original = jest.requireActual('./log');
  return {
    ...original,
    log: {
      asObservable: () =>
        of(
          {
            level: 'info',
            labels: {
              test: 'test',
            },
            timestamp: Date.now(),
            id: nanoid(),
            message: 'a message',
            pluginId: 'grafana-k8-app',
            extensionPointId: 'grafana/dashboards/panel/menu',
          },
          {
            level: 'debug',
            labels: {
              title: 'a link',
              onClick: 'function',
            },
            timestamp: Date.now(),
            id: nanoid(),
            message: 'another message',
          }
        ),
    },
  };
});

describe('ExtensionsLogDataSource', () => {
  const dataSource = new ExtensionsLogDataSource('pluginId', 'ds-uid', log);

  it('should return a stream when querying for data', async () => {
    const response = await lastValueFrom(dataSource.query(createRequest()));
    expect(response.state).toBe(LoadingState.Streaming);
  });

  it('should return logs as data frames when querying for data', async () => {
    const { data } = await lastValueFrom(dataSource.query(createRequest()));
    expect(data).toStrictEqual([
      {
        refId: 'A',
        meta: {
          type: 'log-lines',
        },
        length: 2,
        fields: [
          {
            config: expect.any(Object),
            name: 'timestamp',
            type: 'time',
            values: [expect.any(Number), expect.any(Number)],
          },
          {
            config: expect.any(Object),
            name: 'body',
            type: 'string',
            values: ['another message', 'a message'],
          },
          {
            config: expect.any(Object),
            name: 'severity',
            type: 'string',
            values: ['debug', 'info'],
          },
          {
            config: expect.any(Object),
            name: 'id',
            type: 'string',
            values: [expect.any(String), expect.any(String)],
          },
          {
            config: expect.any(Object),
            name: 'labels',
            type: 'other',
            values: [{ onClick: 'function', title: 'a link' }, { test: 'test' }],
          },
          {
            config: expect.any(Object),
            name: 'pluginId',
            type: 'string',
            values: [null, 'grafana-k8-app'],
          },
          {
            config: expect.any(Object),
            name: 'extensionPointId',
            type: 'string',
            values: [null, 'grafana/dashboards/panel/menu'],
          },
        ],
      },
    ]);
  });
});

function createRequest(): DataQueryRequest {
  return {
    requestId: '',
    interval: '',
    intervalMs: 0,
    range: {
      from: dateTime(),
      to: dateTime(),
      raw: {
        from: '',
        to: '',
      },
    },
    scopedVars: {},
    targets: [{ refId: 'A' }],
    timezone: '',
    app: '',
    startTime: Date.now(),
  };
}
