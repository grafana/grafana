import { lastValueFrom, of } from 'rxjs';

import {
  DataQueryRequest,
  FieldType,
  LogLevel,
  LogRowContextQueryDirection,
  LogRowModel,
  MutableDataFrame,
} from '@grafana/data';

import { regionVariable } from '../mocks/CloudWatchDataSource';
import { setupMockedLogsQueryRunner } from '../mocks/LogsQueryRunner';
import { LogsRequestMock } from '../mocks/Request';
import { validLogsQuery } from '../mocks/queries';
import { CloudWatchLogsQuery } from '../types'; // Add this import statement

import { LOGSTREAM_IDENTIFIER_INTERNAL, LOG_IDENTIFIER_INTERNAL } from './CloudWatchLogsQueryRunner';

describe('CloudWatchLogsQueryRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLogRowContext', () => {
    it('replaces parameters correctly in the query', async () => {
      const { runner, queryMock } = setupMockedLogsQueryRunner({ variables: [regionVariable] });
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
      // sets the default region if region is empty
      expect(queryMock.mock.calls[0][0].targets[0].region).toBe('us-west-1');

      await runner.getLogRowContext(row, { direction: LogRowContextQueryDirection.Forward }, queryMock, {
        ...validLogsQuery,
        region: '$region',
      });
      expect(queryMock.mock.calls[1][0].targets[0].startTime).toBe(4);
      expect(queryMock.mock.calls[1][0].targets[0].region).toBe('templatedRegion');
    });
  });

  describe('handleLogQueries', () => {
    it('should request to start each query and then request to get the query results', async () => {
      const { runner } = setupMockedLogsQueryRunner();

      const options: DataQueryRequest<CloudWatchLogsQuery> = {
        ...LogsRequestMock,
        targets: rawLogQueriesStub,
      };

      const queryFn = jest
        .fn()
        .mockReturnValueOnce(of(startQuerySuccessResponseStub))
        .mockReturnValueOnce(of(getQuerySuccessResponseStub));

      const response = runner.handleLogQueries(rawLogQueriesStub, options, queryFn);
      const results = await lastValueFrom(response);
      expect(queryFn).toHaveBeenCalledTimes(2);
      expect(queryFn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StartQuery' })]),
        })
      );
      expect(queryFn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );

      expect(results).toEqual({
        ...getQuerySuccessResponseStub,
        errors: [],
        key: 'test-key',
      });
    });

    it('should call getQueryResults until the query returns with a status of complete', async () => {
      const { runner } = setupMockedLogsQueryRunner();

      const options: DataQueryRequest<CloudWatchLogsQuery> = {
        ...LogsRequestMock,
        targets: rawLogQueriesStub,
      };

      const queryFn = jest
        .fn()
        .mockReturnValueOnce(of(startQuerySuccessResponseStub))
        .mockReturnValueOnce(of(getQueryLoadingResponseStub))
        .mockReturnValueOnce(of(getQueryLoadingResponseStub))
        .mockReturnValueOnce(of(getQueryLoadingResponseStub))
        .mockReturnValueOnce(of(getQuerySuccessResponseStub));

      const response = runner.handleLogQueries(rawLogQueriesStub, options, queryFn);
      const results = await lastValueFrom(response);
      expect(queryFn).toHaveBeenCalledTimes(5);

      // first call to start query
      expect(queryFn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StartQuery' })]),
        })
      );
      // second call we try to get the results
      expect(queryFn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );
      // after getting a loading response we wait and try again
      expect(queryFn).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );
      // after getting a loading response we wait and try again
      expect(queryFn).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );
      // after getting a loading response we wait and try again
      expect(queryFn).toHaveBeenNthCalledWith(
        5,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );

      expect(results).toEqual({
        ...getQuerySuccessResponseStub,
        errors: [],
        key: 'test-key',
      });
    });

    it('should call getQueryResults until the query returns even if it the startQuery gets a rate limiting error from aws', async () => {
      const { runner } = setupMockedLogsQueryRunner();

      const options: DataQueryRequest<CloudWatchLogsQuery> = {
        ...LogsRequestMock,
        targets: rawLogQueriesStub,
      };

      const queryFn = jest
        .fn()
        .mockReturnValueOnce(of(startQueryErrorWhenRateLimitedResponseStub))
        .mockReturnValueOnce(of(startQuerySuccessResponseStub))
        .mockReturnValueOnce(of(getQuerySuccessResponseStub));

      const response = runner.handleLogQueries(rawLogQueriesStub, options, queryFn);
      const results = await lastValueFrom(response);
      expect(queryFn).toHaveBeenCalledTimes(3);

      // first call
      expect(queryFn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StartQuery' })]),
        })
      );
      // we retry because the first call failed with the rate limiting error
      expect(queryFn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StartQuery' })]),
        })
      );
      // we get results because second call was successful
      expect(queryFn).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );

      expect(results).toEqual({
        ...getQuerySuccessResponseStub,
        errors: [],
        key: 'test-key',
      });
    });

    it('should call getQueryResults until the query returns even if it the startQuery gets a throttling error from aws', async () => {
      const { runner } = setupMockedLogsQueryRunner();

      const options: DataQueryRequest<CloudWatchLogsQuery> = {
        ...LogsRequestMock,
        targets: rawLogQueriesStub,
      };

      const queryFn = jest
        .fn()
        .mockReturnValueOnce(of(startQueryErrorWhenThrottlingResponseStub))
        .mockReturnValueOnce(of(startQuerySuccessResponseStub))
        .mockReturnValueOnce(of(getQuerySuccessResponseStub));

      const response = runner.handleLogQueries(rawLogQueriesStub, options, queryFn);
      const results = await lastValueFrom(response);
      expect(queryFn).toHaveBeenCalledTimes(3);

      // first call
      expect(queryFn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StartQuery' })]),
        })
      );
      // we retry because the first call failed with the rate limiting error
      expect(queryFn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StartQuery' })]),
        })
      );
      // we get results because second call was successful
      expect(queryFn).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );

      expect(results).toEqual({
        ...getQuerySuccessResponseStub,
        errors: [],
        key: 'test-key',
      });
    });

    it('should return an error if it timesout before the start queries can get past a rate limiting error', async () => {
      const { runner } = setupMockedLogsQueryRunner();
      // first time timeout is called it will not be timed out, second time it will be timed out
      const timeoutFunc = jest
        .fn()
        .mockImplementationOnce(() => false)
        .mockImplementationOnce(() => true);
      runner.createTimeoutFn = jest.fn(() => timeoutFunc);

      const options: DataQueryRequest<CloudWatchLogsQuery> = {
        ...LogsRequestMock,
        targets: rawLogQueriesStub,
      };

      // running query fn will always return the rate limit
      const queryFn = jest.fn().mockReturnValue(of(startQueryErrorWhenRateLimitedResponseStub));

      const response = runner.handleLogQueries(rawLogQueriesStub, options, queryFn);
      const results = await lastValueFrom(response);

      expect(queryFn).toHaveBeenCalledTimes(2);

      // first call starts the query, but it fails with rate limiting error
      expect(queryFn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StartQuery' })]),
        })
      );

      // we retry because the first call failed with the rate limiting error and we haven't timed out yet
      expect(queryFn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StartQuery' })]),
        })
      );

      expect(results).toEqual({
        ...startQueryErrorWhenRateLimitedResponseStub,
        key: 'test-key',
        state: 'Done',
      });
    });

    it('should return an error if the start query fails with an error that is not a rate limiting error', async () => {
      const { runner } = setupMockedLogsQueryRunner();

      const options: DataQueryRequest<CloudWatchLogsQuery> = {
        ...LogsRequestMock,
        targets: rawLogQueriesStub,
      };

      const queryFn = jest.fn().mockReturnValueOnce(of(startQueryErrorWhenBadSyntaxResponseStub));

      const response = runner.handleLogQueries(rawLogQueriesStub, options, queryFn);
      const results = await lastValueFrom(response);

      // only one query is made, it gets the error and returns the error
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(queryFn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StartQuery' })]),
        })
      );
      expect(results).toEqual({
        ...startQueryErrorWhenBadSyntaxResponseStub,
        key: 'test-key',
        state: 'Done',
      });
    });

    it('should return an error and stop querying if get query results has finished with errors', async () => {
      const { runner } = setupMockedLogsQueryRunner();

      const options: DataQueryRequest<CloudWatchLogsQuery> = {
        ...LogsRequestMock,
        targets: rawLogQueriesStub,
      };

      const queryFn = jest
        .fn()
        .mockReturnValueOnce(of(startQuerySuccessResponseStub))
        .mockReturnValueOnce(of(getQueryLoadingResponseStub))
        .mockReturnValueOnce(of(getQueryErrorResponseStub))
        .mockReturnValueOnce(of(stopQueryResponseStub));

      const response = runner.handleLogQueries(rawLogQueriesStub, options, queryFn);
      const results = await lastValueFrom(response);

      expect(queryFn).toHaveBeenCalledTimes(4);
      expect(queryFn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StartQuery' })]),
        })
      );
      expect(queryFn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );
      expect(queryFn).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );
      expect(queryFn).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StopQuery' })]),
        })
      );
      expect(results).toEqual({
        ...getQueryErrorResponseStub,
        key: 'test-key',
        state: 'Done',
      });
    });

    it('should return an error and any partial data if it timesout before getting back all the results', async () => {
      const { runner } = setupMockedLogsQueryRunner();
      // mocking running for a while and then timing out
      const timeoutFunc = jest
        .fn()
        .mockImplementationOnce(() => false)
        .mockImplementationOnce(() => false)
        .mockImplementationOnce(() => false)
        .mockImplementationOnce(() => true);
      runner.createTimeoutFn = jest.fn(() => timeoutFunc);

      const queryFn = jest
        .fn()
        .mockReturnValueOnce(of(startQuerySuccessResponseStub))
        .mockReturnValueOnce(of(getQueryLoadingResponseStub))
        .mockReturnValueOnce(of(getQueryLoadingResponseStub))
        .mockReturnValueOnce(of(getQueryLoadingResponseStub))
        .mockReturnValueOnce(of(getQueryLoadingResponseStub))
        .mockReturnValueOnce(of(stopQueryResponseStub));

      const options: DataQueryRequest<CloudWatchLogsQuery> = {
        ...LogsRequestMock,
        targets: rawLogQueriesStub,
      };
      const response = runner.handleLogQueries(rawLogQueriesStub, options, queryFn);
      const results = await lastValueFrom(response);
      expect(queryFn).toHaveBeenCalledTimes(6);
      expect(queryFn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StartQuery' })]),
        })
      );
      expect(queryFn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );
      expect(queryFn).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );
      expect(queryFn).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );
      expect(queryFn).toHaveBeenNthCalledWith(
        5,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'GetQueryResults' })]),
        })
      );
      expect(queryFn).toHaveBeenNthCalledWith(
        6,
        expect.objectContaining({
          targets: expect.arrayContaining([expect.objectContaining({ subtype: 'StopQuery' })]),
        })
      );
      expect(results).toEqual({
        ...getQueryLoadingResponseStub,
        errors: [
          {
            message:
              'Error: Query hit timeout before completing after 3 attempts, partial results may be shown. To increase the timeout window update your datasource configuration.',
            refId: 'A',
            type: 'timeout',
          },
        ],
        key: 'test-key',
        state: 'Done',
      });
    });
  });
});

const rawLogQueriesStub: CloudWatchLogsQuery[] = [
  {
    refId: 'A',
    id: '',
    region: 'us-east-2',
    logGroups: [
      {
        accountId: 'accountId',
        arn: 'somearn',
        name: 'nameOfLogGroup',
      },
    ],
    queryMode: 'Logs',
    expression: 'fields @timestamp, @message |\n sort @timestamp desc |\n limit 20',
    datasource: {
      type: 'cloudwatch',
      uid: 'ff87aa43-7618-42ee-ae9c-4a405378728b',
    },
  },
];

const startQuerySuccessResponseStub = {
  data: [
    {
      name: 'A',
      refId: 'A',
      meta: {
        typeVersion: [0, 0],
        custom: { Region: 'us-east-2' },
      },
      fields: [
        {
          name: 'queryId',
          type: 'string',
          typeInfo: { frame: 'string' },
          config: {},
          values: ['123'],
          entities: {},
        },
      ],
      length: 1,
      state: 'Done',
    },
  ],
};

const startQueryErrorWhenRateLimitedResponseStub = {
  data: [],
  errors: [
    {
      refId: 'A',
      message:
        'failed to execute log action with subtype: StartQuery: LimitExceededException: LimitExceededException: Account maximum query concurrency limit of [30] reached.',
      status: 500,
    },
  ],
};

const startQueryErrorWhenThrottlingResponseStub = {
  data: [],
  errors: [
    {
      refId: 'A',
      message:
        'failed to execute log action with subtype: StartQuery: ThrottlingException: ThrottlingException: Rate exceeded',
      status: 500,
    },
  ],
};

const startQueryErrorWhenBadSyntaxResponseStub = {
  data: [],
  state: 'Error',
  errors: [
    {
      refId: 'A',
      message:
        'failed to execute log action with subtype: StartQuery: MalformedQueryException: unexpected symbol found bad at line 1 and position 843',
      status: 500,
    },
  ],
};

const getQuerySuccessResponseStub = {
  data: [
    {
      name: 'A',
      refId: 'A',
      meta: {
        custom: { Status: 'Complete' },
        typeVersion: [0, 0],
        stats: [
          { displayName: 'Bytes scanned', value: 1000 },
          { displayName: 'Records scanned', value: 1000 },
          { displayName: 'Records matched', value: 1000 },
        ],
      },
      fields: [
        {
          name: '@message',
          type: 'string',
          typeInfo: { frame: 'string' },
          config: {},
          values: ['some log'],
        },
      ],
      length: 1,
      state: 'Done',
    },
  ],
  state: 'Done',
};

const getQueryLoadingResponseStub = {
  data: [
    {
      name: 'A',
      refId: 'A',
      meta: {
        custom: { Status: 'Running' },
        typeVersion: [0, 0],
        stats: [
          { displayName: 'Bytes scanned', value: 1 },
          { displayName: 'Records scanned', value: 1 },
          { displayName: 'Records matched', value: 1 },
        ],
      },
      fields: [
        {
          name: '@message',
          type: 'string',
          typeInfo: { frame: 'string' },
          config: {},
          values: ['some log'],
        },
      ],
      length: 1,
      state: 'Done',
    },
  ],
  state: 'Done',
};

const getQueryErrorResponseStub = {
  data: [],
  errors: [
    {
      refId: 'A',
      message: 'failed to execute log action with subtype: GetQueryResults: AWS is down',
      status: 500,
    },
  ],
  state: 'Error',
};

const stopQueryResponseStub = {
  state: 'Done',
};
