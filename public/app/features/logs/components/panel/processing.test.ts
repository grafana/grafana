import { createTheme, Field, FieldType, LogLevel, LogRowModel, LogsSortOrder, toDataFrame } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { createLogLine, createLogRow } from '../__mocks__/logRow';

import { LogListModel, preProcessLogs } from './processing';
import { getTruncationLength, init } from './virtualization';

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

  test('Returns displayed field values', () => {
    expect(processedLogs[0].getDisplayedFieldValue('logger')).toBe('interceptor');
    expect(processedLogs[1].getDisplayedFieldValue('method')).toBe('POST');
    expect(processedLogs[2].getDisplayedFieldValue('kind')).toBe('Event');
    expect(processedLogs[0].getDisplayedFieldValue(LOG_LINE_BODY_FIELD_NAME)).toBe(processedLogs[0].body);
    expect(processedLogs[1].getDisplayedFieldValue(LOG_LINE_BODY_FIELD_NAME)).toBe(processedLogs[1].body);
    expect(processedLogs[2].getDisplayedFieldValue(LOG_LINE_BODY_FIELD_NAME)).toBe(processedLogs[2].body);
  });

  describe('Collapsible log lines', () => {
    let longLog: LogListModel, entry: string, container: HTMLDivElement;
    beforeEach(() => {
      init(createTheme());
      container = document.createElement('div');
      jest.spyOn(container, 'clientWidth', 'get').mockReturnValue(200);
      entry = new Array(2 * getTruncationLength(null)).fill('e').join('');
      longLog = createLogLine({ entry });
    });

    test('Long lines that are not truncated are not modified', () => {
      expect(longLog.body).toBe(entry);
      expect(longLog.highlightedBody).toBe(entry);
    });

    test('Sets the collapsed state based on the container size', () => {
      // Make container half of the size
      jest.spyOn(container, 'clientWidth', 'get').mockReturnValue(100);

      expect(longLog.collapsed).toBeUndefined();

      longLog.updateCollapsedState([], container);

      expect(longLog.collapsed).toBe(true);
      expect(longLog.body).not.toBe(entry);
      expect(entry).toContain(longLog.body);
    });

    test('Updates the body based on the collapsed state', () => {
      expect(longLog.collapsed).toBeUndefined();
      expect(longLog.body).toBe(entry);

      longLog.setCollapsedState(true);

      expect(longLog.collapsed).toBe(true);
      expect(longLog.body).not.toBe(entry);
      expect(entry).toContain(longLog.body);

      longLog.setCollapsedState(false);

      expect(longLog.collapsed).toBe(false);
      expect(longLog.body).toBe(entry);
    });
  });
});
