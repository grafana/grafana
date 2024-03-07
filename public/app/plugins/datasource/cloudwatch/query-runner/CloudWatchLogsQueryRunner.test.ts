import { interval, lastValueFrom, of } from 'rxjs';

import {
  DataQueryErrorType,
  FieldType,
  LogLevel,
  LogRowModel,
  MutableDataFrame,
  dateTime,
  DataQueryRequest,
  LogRowContextQueryDirection,
} from '@grafana/data';

import {
  CloudWatchSettings,
  limitVariable,
  logGroupNamesVariable,
  regionVariable,
} from '../__mocks__/CloudWatchDataSource';
import { genMockFrames, genMockCloudWatchLogsRequest, setupMockedLogsQueryRunner } from '../__mocks__/LogsQueryRunner';
import { LogsRequestMock } from '../__mocks__/Request';
import { validLogsQuery } from '../__mocks__/queries';
import { CloudWatchLogsQuery, LogAction, StartQueryRequest } from '../types';
import * as rxjsUtils from '../utils/rxjs/increasingInterval';

import { LOG_IDENTIFIER_INTERNAL, LOGSTREAM_IDENTIFIER_INTERNAL } from './CloudWatchLogsQueryRunner';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  getDefaultTimeRange: jest.fn().mockImplementation(() => {
    const from = dateTime(1111);
    const to = dateTime(2222);
    return { from, to, raw: { from, to } };
  }),
}));

describe('CloudWatchLogsQueryRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLogRowContext', () => {
    it('replaces parameters correctly in the query', async () => {
      const { runner, queryMock } = setupMockedLogsQueryRunner();
      const row: LogRowModel = {
        entryFieldIndex: 0,
        rowIndex: 0,
        dataFrame: new MutableDataFrame({
          refId: 'B',
          fields: [
            { name: 'ts', type: FieldType.time, values: [1] },
            { name: LOG_IDENTIFIER_INTERNAL, type: FieldType.string, values: ['foo'], labels: {} },
            { name: LOGSTREAM_IDENTIFIER_INTERNAL, type: FieldType.string, values: ['bar'], labels: {} },
          ],
        }),
        entry: '4',
        labels: {},
        hasAnsi: false,
        hasUnescapedContent: false,
        raw: '4',
        logLevel: LogLevel.info,
        timeEpochMs: 4,
        timeEpochNs: '4000000',
        timeFromNow: '',
        timeLocal: '',
        timeUtc: '',
        uid: '1',
      };
      await runner.getLogRowContext(row, undefined, queryMock);
      expect(queryMock.mock.calls[0][0].targets[0].endTime).toBe(4);
      expect(queryMock.mock.calls[0][0].targets[0].region).toBe('');

      await runner.getLogRowContext(row, { direction: LogRowContextQueryDirection.Forward }, queryMock, {
        ...validLogsQuery,
        region: 'eu-east',
      });
      expect(queryMock.mock.calls[1][0].targets[0].startTime).toBe(4);
      expect(queryMock.mock.calls[1][0].targets[0].region).toBe('eu-east');
    });
  });

  describe('logs query', () => {
    beforeEach(() => {
      jest.spyOn(rxjsUtils, 'increasingInterval').mockImplementation(() => interval(100));
    });

    it('should stop querying when timed out', async () => {
      const { runner, queryMock } = setupMockedLogsQueryRunner();
      const fakeFrames = genMockFrames(20);
      const initialRecordsMatched = fakeFrames[0].meta!.stats!.find(
        (stat) => stat.displayName === 'Records scanned'
      )!.value!;
      for (let i = 1; i < 4; i++) {
        fakeFrames[i].meta!.stats = [
          {
            displayName: 'Records scanned',
            value: initialRecordsMatched,
          },
        ];
      }

      const finalRecordsMatched = fakeFrames[9].meta!.stats!.find(
        (stat) => stat.displayName === 'Records scanned'
      )!.value!;
      for (let i = 10; i < fakeFrames.length; i++) {
        fakeFrames[i].meta!.stats = [
          {
            displayName: 'Records scanned',
            value: finalRecordsMatched,
          },
        ];
      }

      let i = 0;
      jest.spyOn(runner, 'makeLogActionRequest').mockImplementation((subtype: LogAction) => {
        if (subtype === 'GetQueryResults') {
          const mockObservable = of([fakeFrames[i]]);
          i++;
          return mockObservable;
        } else {
          return of([]);
        }
      });

      const iterations = 15;
      // Times out after 15 passes for consistent testing
      const timeoutFunc = () => {
        return i >= iterations;
      };
      const myResponse = await lastValueFrom(
        runner.logsQuery([{ queryId: 'fake-query-id', region: 'default', refId: 'A' }], timeoutFunc, queryMock)
      );

      const expectedData = [
        {
          ...fakeFrames[14],
          meta: {
            custom: {
              Status: 'Cancelled',
            },
            stats: fakeFrames[14].meta!.stats,
          },
        },
      ];

      expect(myResponse).toEqual({
        data: expectedData,
        key: 'test-key',
        state: 'Done',
        error: {
          type: DataQueryErrorType.Timeout,
          message: `error: query timed out after 5 attempts`,
        },
      });
      expect(i).toBe(iterations);
    });

    it('should continue querying as long as new data is being received', async () => {
      const { runner, queryMock } = setupMockedLogsQueryRunner();
      const fakeFrames = genMockFrames(15);

      let i = 0;
      jest.spyOn(runner, 'makeLogActionRequest').mockImplementation((subtype: LogAction) => {
        if (subtype === 'GetQueryResults') {
          const mockObservable = of([fakeFrames[i]]);
          i++;
          return mockObservable;
        } else {
          return of([]);
        }
      });

      const startTime = new Date();
      const timeoutFunc = () => {
        return Date.now() >= startTime.valueOf() + 6000;
      };
      const myResponse = await lastValueFrom(
        runner.logsQuery([{ queryId: 'fake-query-id', region: 'default', refId: 'A' }], timeoutFunc, queryMock)
      );
      expect(myResponse).toEqual({
        data: [fakeFrames[fakeFrames.length - 1]],
        key: 'test-key',
        state: 'Done',
      });
      expect(i).toBe(15);
    });

    it('should stop querying when results come back with status "Complete"', async () => {
      const { runner, queryMock } = setupMockedLogsQueryRunner();
      const fakeFrames = genMockFrames(3);
      let i = 0;
      jest.spyOn(runner, 'makeLogActionRequest').mockImplementation((subtype: LogAction) => {
        if (subtype === 'GetQueryResults') {
          const mockObservable = of([fakeFrames[i]]);
          i++;
          return mockObservable;
        } else {
          return of([]);
        }
      });

      const startTime = new Date();
      const timeoutFunc = () => {
        return Date.now() >= startTime.valueOf() + 6000;
      };
      const myResponse = await lastValueFrom(
        runner.logsQuery([{ queryId: 'fake-query-id', region: 'default', refId: 'A' }], timeoutFunc, queryMock)
      );

      expect(myResponse).toEqual({
        data: [fakeFrames[2]],
        key: 'test-key',
        state: 'Done',
      });
      expect(i).toBe(3);
    });
  });

  const legacyLogGroupNamesQuery: CloudWatchLogsQuery = {
    queryMode: 'Logs',
    logGroupNames: ['group-A', 'templatedGroup-1', `$${logGroupNamesVariable.name}`],
    hide: false,
    id: '',
    region: 'us-east-2',
    refId: 'A',
    expression: `fields @timestamp, @message | sort @timestamp desc | limit $${limitVariable.name}`,
  };

  const logGroupNamesQuery: CloudWatchLogsQuery = {
    queryMode: 'Logs',
    logGroups: [
      { arn: 'arn:aws:logs:us-east-2:123456789012:log-group:group-A:*', name: 'group-A' },
      { arn: `$${logGroupNamesVariable.name}`, name: logGroupNamesVariable.name },
    ],
    hide: false,
    id: '',
    region: '$' + regionVariable.name,
    refId: 'A',
    expression: `fields @timestamp, @message | sort @timestamp desc | limit 1`,
  };

  const logsScopedVarQuery: CloudWatchLogsQuery = {
    queryMode: 'Logs',
    logGroups: [{ arn: `$${logGroupNamesVariable.name}`, name: logGroupNamesVariable.name }],
    hide: false,
    id: '',
    region: '$' + regionVariable.name,
    refId: 'A',
    expression: `stats count(*) by queryType, bin(20s)`,
  };

  describe('handleLogQueries', () => {
    it('should map log queries to start query requests correctly', async () => {
      const { runner, queryMock } = setupMockedLogsQueryRunner({
        variables: [logGroupNamesVariable, regionVariable, limitVariable],
        settings: {
          ...CloudWatchSettings,
          jsonData: {
            ...CloudWatchSettings.jsonData,
            logsTimeout: '500ms',
          },
        },
        mockGetVariableName: false,
      });
      const spy = jest.spyOn(runner, 'makeLogActionRequest');
      await lastValueFrom(
        runner.handleLogQueries(
          [legacyLogGroupNamesQuery, logGroupNamesQuery, logsScopedVarQuery],
          LogsRequestMock,
          queryMock
        )
      );
      const startQueryRequests: StartQueryRequest[] = [
        {
          queryString: `fields @timestamp, @message | sort @timestamp desc | limit ${limitVariable.current.value}`,
          logGroupNames: ['group-A', ...logGroupNamesVariable.current.text],
          logGroups: [],
          refId: legacyLogGroupNamesQuery.refId,
          region: legacyLogGroupNamesQuery.region,
        },
        {
          queryString: logGroupNamesQuery.expression!,
          logGroupNames: [],
          logGroups: [
            {
              arn: 'arn:aws:logs:us-east-2:123456789012:log-group:group-A:*',
              name: 'arn:aws:logs:us-east-2:123456789012:log-group:group-A:*',
            },
            ...(logGroupNamesVariable.current.value as string[]).map((v) => ({ arn: v, name: v })),
          ],
          refId: legacyLogGroupNamesQuery.refId,
          region: regionVariable.current.value as string,
        },
        {
          queryString: `stats count(*) by queryType, bin(20s)`,
          logGroupNames: [],
          logGroups: [...(logGroupNamesVariable.current.value as string[]).map((v) => ({ arn: v, name: v }))],
          refId: legacyLogGroupNamesQuery.refId,
          region: regionVariable.current.value as string,
        },
      ];
      expect(spy).toHaveBeenNthCalledWith(1, 'StartQuery', startQueryRequests, queryMock, LogsRequestMock);
    });
  });

  describe('makeLogActionRequest', () => {
    it('should use the time range from the options if it is available', async () => {
      const { runner, queryMock } = setupMockedLogsQueryRunner();
      const from = dateTime(0);
      const to = dateTime(1000);
      const options: DataQueryRequest<CloudWatchLogsQuery> = {
        ...LogsRequestMock,
        range: { from, to, raw: { from, to } },
      };
      await lastValueFrom(
        runner.makeLogActionRequest('StartQuery', [genMockCloudWatchLogsRequest()], queryMock, options)
      );
      expect(queryMock.mock.calls[0][0].skipQueryCache).toBe(true);
      expect(queryMock.mock.calls[0][0]).toEqual(expect.objectContaining({ range: { from, to, raw: { from, to } } }));
    });

    it('should use the default time range if the time range in the options is not available', async () => {
      const from = dateTime(1111);
      const to = dateTime(2222);
      const { runner, queryMock } = setupMockedLogsQueryRunner();
      await lastValueFrom(runner.makeLogActionRequest('StartQuery', [genMockCloudWatchLogsRequest()], queryMock));

      expect(queryMock.mock.calls[0][0].skipQueryCache).toBe(true);
      expect(queryMock.mock.calls[0][0]).toEqual(expect.objectContaining({ range: { from, to, raw: { from, to } } }));
    });
  });
});
