import { Field, FieldType, LogLevel, LogRowModel, LogsSortOrder, toDataFrame } from '@grafana/data';

import { createLogRow } from '../__mocks__/logRow';

import { LogListModel, preProcessLogs } from './processing';

describe('preProcessLogs', () => {
  let logFmtLog: LogRowModel, nginxLog: LogRowModel, jsonLog: LogRowModel;
  let processedLogs: LogListModel[];

  beforeEach(() => {
    const getFieldLinks = jest.fn().mockImplementationOnce((field: Field) => ({
      href: '/link',
      title: 'link',
      target: '_blank',
      origin: field,
    }));
    logFmtLog = createLogRow({
      uid: '1',
      timeEpochMs: 3,
      labels: { level: 'warn', logger: 'interceptor' },
      entry: `logger=interceptor t=2025-03-18T08:58:34.820119602Z level=warn msg="calling resource store as the service without id token or marking it as the service identity" subject=:0 uid=43eb4c92-18a0-4060-be96-37af854f0830`,
      logLevel: LogLevel.warning,
      rowIndex: 0,
      dataFrame: toDataFrame({
        refId: 'A',
        fields: [
          { name: 'Time', type: FieldType.time, values: [3, 2, 1] },
          {
            name: 'Line',
            type: FieldType.string,
            values: ['log message 1', 'log message 2', 'log message 3'],
          },
          {
            name: 'labels',
            type: FieldType.other,
            values: [
              { level: 'warn', logger: 'interceptor' },
              { method: 'POST', status: '200' },
              { kind: 'Event', stage: 'ResponseComplete' },
            ],
          },
          {
            name: 'link',
            type: FieldType.string,
            config: {
              links: [
                {
                  title: 'link1',
                  url: 'https://example.com',
                },
              ],
            },
            values: ['link'],
          },
        ],
      }),
    });
    nginxLog = createLogRow({
      uid: '2',
      timeEpochMs: 2,
      labels: { method: 'POST', status: '200' },
      entry: `35.191.12.195 - accounts.google.com:test@grafana.com [18/Mar/2025:08:58:38 +0000] 200 "POST /grafana/api/ds/query?ds_type=prometheus&requestId=SQR461 HTTP/1.1" 59460 "https://test.example.com/?orgId=1" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36" "95.91.240.90, 34.107.247.24"`,
      logLevel: LogLevel.critical,
    });
    jsonLog = createLogRow({
      uid: '3',
      timeEpochMs: 1,
      labels: { kind: 'Event', stage: 'ResponseComplete' },
      entry: `{"kind":"Event","apiVersion":"audit.k8s.io/v1","level":"Request","auditID":"2052d577-3391-4fe7-9fe2-4d6c8cbe398f","stage":"ResponseComplete","requestURI":"/api/v1/test","verb":"list","user":{"username":"system:apiserver","uid":"6f35feec-4522-4f21-8289-668e336967b5","groups":["system:authenticated","system:masters"]},"sourceIPs":["::1"],"userAgent":"kube-apiserver/v1.31.5 (linux/amd64) kubernetes/test","objectRef":{"resource":"resourcequotas","namespace":"test","apiVersion":"v1"},"responseStatus":{"metadata":{},"code":200},"requestReceivedTimestamp":"2025-03-18T08:58:34.940093Z"}`,
      logLevel: LogLevel.error,
    });
    processedLogs = preProcessLogs([logFmtLog, nginxLog, jsonLog], {
      escape: false,
      getFieldLinks,
      order: LogsSortOrder.Descending,
      timeZone: 'browser',
    });
  });

  test('Orders logs', () => {
    expect(processedLogs[0].uid).toBe('1');
    expect(processedLogs[1].uid).toBe('2');
    expect(processedLogs[2].uid).toBe('3');
  });

  test('Sets the display level level', () => {
    expect(processedLogs[0].displayLevel).toBe('warn');
    expect(processedLogs[1].displayLevel).toBe('crit');
    expect(processedLogs[2].displayLevel).toBe('error');
  });

  test('Sets the log fields links', () => {
    expect(processedLogs[0].fields).toEqual([
      {
        fieldIndex: 3,
        keys: ['link'],
        links: {
          href: '/link',
          origin: {
            config: {
              links: [
                {
                  title: 'link1',
                  url: 'https://example.com',
                },
              ],
            },
            index: 3,
            name: 'link',
            type: 'string',
            values: ['link'],
          },
          target: '_blank',
          title: 'link',
        },
        values: ['link'],
      },
    ]);
    expect(processedLogs[1].fields).toEqual([]);
    expect(processedLogs[2].fields).toEqual([]);
  });

  test('Highlights tokens in log lines', () => {
    expect(processedLogs[0].highlightedBody).toContain('log-token-label');
    expect(processedLogs[0].highlightedBody).toContain('log-token-key');
    expect(processedLogs[0].highlightedBody).toContain('log-token-string');
    expect(processedLogs[0].highlightedBody).toContain('log-token-uuid');
    expect(processedLogs[0].highlightedBody).not.toContain('log-token-method');
    expect(processedLogs[0].highlightedBody).not.toContain('log-token-json-key');

    expect(processedLogs[1].highlightedBody).toContain('log-token-method');
    expect(processedLogs[1].highlightedBody).toContain('log-token-key');
    expect(processedLogs[1].highlightedBody).toContain('log-token-string');
    expect(processedLogs[1].highlightedBody).not.toContain('log-token-json-key');

    expect(processedLogs[2].highlightedBody).toContain('log-token-json-key');
    expect(processedLogs[2].highlightedBody).toContain('log-token-string');
    expect(processedLogs[2].highlightedBody).not.toContain('log-token-method');
  });
});
