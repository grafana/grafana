import { interval, lastValueFrom, of } from 'rxjs';

import { LogRowModel, MutableDataFrame, FieldType, LogLevel, dataFrameToJSON, DataQueryErrorType } from '@grafana/data';

import { genMockFrames, setupMockedLogsQueryRunner } from '../__mocks__/LogsQueryRunner';
import { validLogsQuery } from '../__mocks__/queries';
import { LogAction } from '../types';
import * as rxjsUtils from '../utils/rxjs/increasingInterval';

import { LOG_IDENTIFIER_INTERNAL, LOGSTREAM_IDENTIFIER_INTERNAL } from './CloudWatchLogsQueryRunner';

describe('CloudWatchLogsQueryRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLogRowContext', () => {
    it('replaces parameters correctly in the query', async () => {
      const { runner, fetchMock } = setupMockedLogsQueryRunner();
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
      await runner.getLogRowContext(row);
      expect(fetchMock.mock.calls[0][0].data.queries[0].endTime).toBe(4);
      expect(fetchMock.mock.calls[0][0].data.queries[0].region).toBe(undefined);

      await runner.getLogRowContext(row, { direction: 'FORWARD' }, { ...validLogsQuery, region: 'eu-east' });
      expect(fetchMock.mock.calls[1][0].data.queries[0].startTime).toBe(4);
      expect(fetchMock.mock.calls[1][0].data.queries[0].region).toBe('eu-east');
    });
  });

  describe('getLogGroupFields', () => {
    it('passes region correctly', async () => {
      const { runner, fetchMock } = setupMockedLogsQueryRunner();
      fetchMock.mockReturnValueOnce(
        of({
          data: {
            results: {
              A: {
                frames: [
                  dataFrameToJSON(
                    new MutableDataFrame({
                      fields: [
                        { name: 'key', values: [] },
                        { name: 'val', values: [] },
                      ],
                    })
                  ),
                ],
              },
            },
          },
        })
      );
      await runner.getLogGroupFields({ region: 'us-west-1', logGroupName: 'test' });
      expect(fetchMock.mock.calls[0][0].data.queries[0].region).toBe('us-west-1');
    });
  });

  describe('logs query', () => {
    beforeEach(() => {
      jest.spyOn(rxjsUtils, 'increasingInterval').mockImplementation(() => interval(100));
    });

    it('should stop querying when timed out', async () => {
      const { runner } = setupMockedLogsQueryRunner();
      const fakeFrames = genMockFrames(20);
      const initialRecordsMatched = fakeFrames[0].meta!.stats!.find((stat) => stat.displayName === 'Records scanned')!
        .value!;
      for (let i = 1; i < 4; i++) {
        fakeFrames[i].meta!.stats = [
          {
            displayName: 'Records scanned',
            value: initialRecordsMatched,
          },
        ];
      }

      const finalRecordsMatched = fakeFrames[9].meta!.stats!.find((stat) => stat.displayName === 'Records scanned')!
        .value!;
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
        runner.logsQuery([{ queryId: 'fake-query-id', region: 'default', refId: 'A' }], timeoutFunc)
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
      const { runner } = setupMockedLogsQueryRunner();
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
        runner.logsQuery([{ queryId: 'fake-query-id', region: 'default', refId: 'A' }], timeoutFunc)
      );
      expect(myResponse).toEqual({
        data: [fakeFrames[fakeFrames.length - 1]],
        key: 'test-key',
        state: 'Done',
      });
      expect(i).toBe(15);
    });

    it('should stop querying when results come back with status "Complete"', async () => {
      const { runner } = setupMockedLogsQueryRunner();
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
        runner.logsQuery([{ queryId: 'fake-query-id', region: 'default', refId: 'A' }], timeoutFunc)
      );

      expect(myResponse).toEqual({
        data: [fakeFrames[2]],
        key: 'test-key',
        state: 'Done',
      });
      expect(i).toBe(3);
    });
  });
});
