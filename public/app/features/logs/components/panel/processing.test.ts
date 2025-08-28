import { createTheme, Field, FieldType, LogLevel, LogRowModel, LogsSortOrder, toDataFrame } from '@grafana/data';
import { config } from '@grafana/runtime';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { createLogLine, createLogRow } from '../mocks/logRow';

import { LogListFontSize } from './LogList';
import { LogListModel, preProcessLogs } from './processing';
import { LogLineVirtualization } from './virtualization';

describe('preProcessLogs', () => {
  let logFmtLog: LogRowModel, nginxLog: LogRowModel, jsonLog: LogRowModel;
  let processedLogs: LogListModel[];
  const fontSizes: LogListFontSize[] = ['default', 'small'];

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
      wrapLogMessage: true,
    });
  });

  describe('LogListModel', () => {
    test('Extends a LogRowModel', () => {
      const logRowModel = createLogRow({
        uid: '2',
        datasourceUid: 'test',
        timeEpochMs: 2,
        labels: { method: 'POST', status: '200' },
        entry: `35.191.12.195 - accounts.google.com:test@grafana.com [18/Mar/2025:08:58:38 +0000] 200 "POST /grafana/api/ds/query?ds_type=prometheus&requestId=SQR461 HTTP/1.1" 59460 "https://test.example.com/?orgId=1" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36" "95.91.240.90, 34.107.247.24"`,
        logLevel: LogLevel.critical,
      });
      const logListModel = new LogListModel(logRowModel, { escape: false, timeZone: 'browser ', wrapLogMessage: true });
      expect(logListModel).toMatchObject(logRowModel);
    });

    test('Unwrapped log lines strip new lines', () => {
      const logListModel = createLogLine(
        { labels: { place: `lu\nna` }, entry: `log\n message\n 1` },
        {
          escape: false,
          order: LogsSortOrder.Descending,
          timeZone: 'browser',
          wrapLogMessage: false, // unwrapped
        }
      );
      expect(logListModel.getDisplayedFieldValue('place')).toBe('luna');
      expect(logListModel.body).toBe('log message 1');
    });

    test('Wrapped log lines do not modify new lines', () => {
      const logListModel = createLogLine(
        { labels: { place: `lu\nna` }, entry: `log\n message\n 1` },
        {
          escape: false,
          order: LogsSortOrder.Descending,
          timeZone: 'browser',
          wrapLogMessage: true, // wrapped
        }
      );
      expect(logListModel.getDisplayedFieldValue('place')).toBe(logListModel.labels['place']);
      expect(logListModel.body).toBe(logListModel.raw);
    });

    test('Strips ansi colors for measurement', () => {
      const logListModel = createLogLine(
        { entry: `log \u001B[31mmessage\u001B[0m 1` },
        {
          escape: false,
          order: LogsSortOrder.Descending,
          timeZone: 'browser',
          wrapLogMessage: true,
        }
      );
      expect(logListModel.getDisplayedFieldValue(LOG_LINE_BODY_FIELD_NAME, false)).toBe(
        `log \u001B[31mmessage\u001B[0m 1`
      );
      expect(logListModel.getDisplayedFieldValue(LOG_LINE_BODY_FIELD_NAME, true)).toBe('log message 1');
    });

    test('Does not modify unwrapped JSON', () => {
      const entry = '{"key": "value", "otherKey": "otherValue"}';
      const logListModel = createLogLine(
        { entry },
        {
          escape: false,
          order: LogsSortOrder.Descending,
          timeZone: 'browser',
          wrapLogMessage: false, // unwrapped
        }
      );
      expect(logListModel.entry).toBe(entry);
      expect(logListModel.body).toBe(entry);
    });

    test('Does not modify wrapped JSON', () => {
      const entry = '{"key": "value", "otherKey": "otherValue"}';
      const logListModel = createLogLine(
        { entry },
        {
          escape: false,
          order: LogsSortOrder.Descending,
          timeZone: 'browser',
          wrapLogMessage: false, // unwrapped
          prettifyJSON: false,
        }
      );
      expect(logListModel.entry).toBe(entry);
      expect(logListModel.body).toBe(entry);
    });

    test('Prettifies wrapped JSON', () => {
      const entry = '{"key": "value", "otherKey": "otherValue"}';
      const logListModel = createLogLine(
        { entry },
        {
          escape: false,
          order: LogsSortOrder.Descending,
          timeZone: 'browser',
          wrapLogMessage: true, // wrapped
          prettifyJSON: true,
        }
      );
      expect(logListModel.entry).toBe(entry);
      expect(logListModel.body).not.toBe(entry);
    });

    test('Uses lossless parsing', () => {
      const entry = '{"number": 90071992547409911}';
      const logListModel = createLogLine(
        { entry },
        {
          escape: false,
          order: LogsSortOrder.Descending,
          timeZone: 'browser',
          wrapLogMessage: false, // unwrapped
        }
      );
      expect(logListModel.entry).toBe(entry);
      expect(logListModel.body).toContain('90071992547409911');
    });

    test.each([
      '{"timestamp":"2025-08-19T12:34:56Z","level":"INFO","message":"User logged in","user_id":1234}',
      '{"time":"2025-08-19T12:35:10Z","level":"ERROR","service":"payment","error":"Insufficient funds","transaction_id":"tx-98765"}',
      '{"ts":1692444912,"lvl":"WARN","component":"auth","msg":"Token expired","session_id":"abcd1234"}',
      '{"@timestamp":"2025-08-19T12:36:00Z","severity":"DEBUG","event":"cache_hit","key":"user_profile:1234","duration_ms":3}',
      '{}',
    ])('Detects JSON logs', (entry: string) => {
      const logListModel = createLogLine(
        { entry },
        {
          escape: false,
          order: LogsSortOrder.Descending,
          timeZone: 'browser',
          wrapLogMessage: false,
        }
      );
      expect(logListModel.body).toBeDefined(); // Triggers parsing
      expect(logListModel.isJSON).toBe(true);
    });

    test.each(['1', '"1"', 'true', 'null', 'false', 'not json', '"nope"'])('Detects non-JSON logs', (entry: string) => {
      const logListModel = createLogLine(
        { entry },
        {
          escape: false,
          order: LogsSortOrder.Descending,
          timeZone: 'browser',
          wrapLogMessage: false,
        }
      );
      expect(logListModel.body).toBeDefined(); // Triggers parsing
      expect(logListModel.isJSON).toBe(false);
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

  describe.each(fontSizes)('Collapsible log lines', (fontSize: LogListFontSize) => {
    let longLog: LogListModel, entry: string, container: HTMLDivElement, virtualization: LogLineVirtualization;
    beforeEach(() => {
      virtualization = new LogLineVirtualization(createTheme(), fontSize);
      container = document.createElement('div');
      jest.spyOn(container, 'clientWidth', 'get').mockReturnValue(200);
      entry = new Array(2 * virtualization.getTruncationLength(null)).fill('e').join('');
      longLog = createLogLine(
        { entry, labels: { field: 'value' } },
        { escape: false, order: LogsSortOrder.Descending, timeZone: 'browser', virtualization, wrapLogMessage: true }
      );
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

    test('Sets the collapsed state based on the new lines count', () => {
      const entry = new Array(virtualization.getTruncationLineCount()).fill('test\n').join('');
      const multilineLog = createLogLine(
        { entry, labels: { field: 'value' } },
        { escape: false, order: LogsSortOrder.Descending, timeZone: 'browser', virtualization, wrapLogMessage: true }
      );

      expect(multilineLog.collapsed).toBeUndefined();

      multilineLog.updateCollapsedState([], container);

      expect(multilineLog.collapsed).toBe(true);
      expect(entry).toContain(multilineLog.body);
    });

    test('Correctly counts new lines', () => {
      const entry = new Array(virtualization.getTruncationLineCount() - 1).fill('test\n').join('');
      const multilineLog = createLogLine(
        { entry, labels: { field: 'value' } },
        { escape: false, order: LogsSortOrder.Descending, timeZone: 'browser', virtualization, wrapLogMessage: true }
      );

      expect(multilineLog.collapsed).toBeUndefined();

      multilineLog.updateCollapsedState([], container);

      expect(multilineLog.collapsed).toBeUndefined();
    });

    test('Considers the displayed fields to set the collapsed state', () => {
      // Make container half of the size
      jest.spyOn(container, 'clientWidth', 'get').mockReturnValue(100);

      expect(longLog.collapsed).toBeUndefined();

      // Log line body is not included in the displayed fields, so it fits in the container
      longLog.updateCollapsedState(['field'], container);

      expect(longLog.collapsed).toBeUndefined();
    });

    test('Considers new lines in displayed fields to set the collapsed state', () => {
      const entry = new Array(virtualization.getTruncationLineCount() - 1).fill('test\n').join('');
      const field = 'test\n';
      const multilineLog = createLogLine(
        { entry, labels: { field } },
        { escape: false, order: LogsSortOrder.Descending, timeZone: 'browser', virtualization, wrapLogMessage: true }
      );

      expect(multilineLog.collapsed).toBeUndefined();

      multilineLog.updateCollapsedState(['field', LOG_LINE_BODY_FIELD_NAME], container);

      expect(multilineLog.collapsed).toBe(true);
      expect(entry).toContain(multilineLog.body);
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

describe('OTel logs', () => {
  let originalOtelLogsFormatting = config.featureToggles.otelLogsFormatting;
  afterAll(() => {
    config.featureToggles.otelLogsFormatting = originalOtelLogsFormatting;
  });

  test('Requires a feature flag', () => {
    const log = createLogLine({
      labels: {
        severity_number: '1',
        telemetry_sdk_language: 'php',
        scope_name: 'scope',
        aws_ignore: 'ignored',
        key: 'value',
        otel: 'otel',
      },
      entry: `place="luna" 1ms 3 KB`,
    });
    expect(log.otelLanguage).toBeDefined();
    expect(log.body).toEqual(`place="luna" 1ms 3 KB`);
  });

  test('Augments OTel log lines', () => {
    config.featureToggles.otelLogsFormatting = true;
    const log = createLogLine({
      labels: {
        severity_number: '1',
        telemetry_sdk_language: 'php',
        scope_name: 'scope',
        aws_ignore: 'ignored',
        key: 'value',
        otel: 'otel',
      },
      entry: `place="luna" 1ms 3 KB`,
    });
    expect(log.otelLanguage).toBeDefined();
    expect(log.body).toEqual(`place="luna" 1ms 3 KB key=value otel=otel`);
  });
});
