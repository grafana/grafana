jest.mock('@grafana/data/src/utils/moment_wrapper', () => ({
  dateTime: (ts: any) => {
    return {
      valueOf: () => ts,
      fromNow: () => 'fromNow() jest mocked',
      format: (fmt: string) => 'format() jest mocked',
    };
  },
  toUtc: (ts: any) => {
    return {
      format: (fmt: string) => 'format() jest mocked',
    };
  },
}));

import { ResultProcessor } from './ResultProcessor';
import { ExploreItemState, ExploreMode } from 'app/types/explore';
import TableModel from 'app/core/table_model';
import { TimeSeries, LogRowModel, LogsMetaItem, GraphSeriesXY, toDataFrame, FieldType } from '@grafana/data';

const testContext = (options: any = {}) => {
  const timeSeries = toDataFrame({
    name: 'A-series',
    refId: 'A',
    fields: [
      { name: 'A-series', type: FieldType.number, values: [4, 5, 6] },
      { name: 'time', type: FieldType.time, values: [100, 200, 300] },
    ],
  });

  const table = toDataFrame({
    name: 'table-res',
    refId: 'A',
    fields: [
      { name: 'value', type: FieldType.number, values: [4, 5, 6] },
      { name: 'time', type: FieldType.time, values: [100, 200, 300] },
      { name: 'message', type: FieldType.string, values: ['this is a message', 'second message', 'third'] },
    ],
  });

  const defaultOptions = {
    mode: ExploreMode.Metrics,
    replacePreviousResults: true,
    dataFrames: [timeSeries, table],
    graphResult: [] as TimeSeries[],
    tableResult: new TableModel(),
    logsResult: { hasUniqueLabels: false, rows: [] as LogRowModel[] },
  };

  const combinedOptions = { ...defaultOptions, ...options };

  const state = ({
    mode: combinedOptions.mode,
    graphResult: combinedOptions.graphResult,
    tableResult: combinedOptions.tableResult,
    logsResult: combinedOptions.logsResult,
    queryIntervals: { intervalMs: 10 },
  } as any) as ExploreItemState;

  const resultProcessor = new ResultProcessor(
    state,
    combinedOptions.replacePreviousResults,
    combinedOptions.dataFrames
  );

  return {
    dataFrames: combinedOptions.dataFrames,
    resultProcessor,
  };
};

describe('ResultProcessor', () => {
  describe('constructed without result', () => {
    describe('when calling getGraphResult', () => {
      it('then it should return an empty array', () => {
        const { resultProcessor } = testContext({ dataFrames: [] });
        const theResult = resultProcessor.getGraphResult();

        expect(theResult).toEqual([]);
      });
    });

    describe('when calling getTableResult', () => {
      it('then it should return an empty TableModel', () => {
        const { resultProcessor } = testContext({ dataFrames: [] });
        const theResult = resultProcessor.getTableResult();

        expect(theResult).toEqual(new TableModel());
      });
    });

    describe('when calling getLogsResult', () => {
      it('then it should return null', () => {
        const { resultProcessor } = testContext({ dataFrames: [] });
        const theResult = resultProcessor.getLogsResult();

        expect(theResult).toBeNull();
      });
    });
  });

  describe('constructed with a result that is a DataQueryResponse', () => {
    describe('when calling getGraphResult', () => {
      it('then it should return correct graph result', () => {
        const { resultProcessor } = testContext();
        const theResult = resultProcessor.getGraphResult();

        expect(theResult).toEqual([
          {
            label: 'A-series',
            color: '#7EB26D',
            data: [[100, 4], [200, 5], [300, 6]],
            info: undefined,
            isVisible: true,
            yAxis: {
              index: 1,
            },
          },
        ]);
      });
    });

    describe('when calling getTableResult', () => {
      it('then it should return correct table result', () => {
        const { resultProcessor } = testContext();
        const theResult = resultProcessor.getTableResult();

        expect(theResult).toEqual({
          columnMap: {},
          columns: [
            { text: 'value', type: 'number', filterable: undefined },
            { text: 'time', type: 'time', filterable: undefined },
            { text: 'message', type: 'string', filterable: undefined },
          ],
          rows: [[4, 100, 'this is a message'], [5, 200, 'second message'], [6, 300, 'third']],
          type: 'table',
        });
      });
    });

    describe('when calling getLogsResult', () => {
      it('then it should return correct logs result', () => {
        const { resultProcessor } = testContext({ mode: ExploreMode.Logs });
        const theResult = resultProcessor.getLogsResult();

        expect(theResult).toEqual({
          hasUniqueLabels: false,
          meta: [],
          rows: [
            {
              entry: 'third',
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'third',
              searchWords: [] as string[],
              timeEpochMs: 300,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              timestamp: 300,
              uniqueLabels: {},
            },
            {
              entry: 'second message',
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'second message',
              searchWords: [] as string[],
              timeEpochMs: 200,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              timestamp: 200,
              uniqueLabels: {},
            },
            {
              entry: 'this is a message',
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'this is a message',
              searchWords: [] as string[],
              timeEpochMs: 100,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              timestamp: 100,
              uniqueLabels: {},
            },
          ],
          series: [
            {
              label: 'A-series',
              color: '#7EB26D',
              data: [[100, 4], [200, 5], [300, 6]],
              info: undefined,
              isVisible: true,
              yAxis: {
                index: 1,
              },
            },
          ],
        });
      });
    });
  });

  describe('constructed with result that is a DataQueryResponse and merging with previous results', () => {
    describe('when calling getLogsResult', () => {
      it('then it should return correct logs result', () => {
        const { resultProcessor } = testContext({
          mode: ExploreMode.Logs,
          replacePreviousResults: false,
          logsResult: {
            hasUniqueLabels: false,
            meta: [],
            rows: [
              {
                entry: 'This is a previous message 1',
                fresh: true,
                hasAnsi: false,
                labels: { cluster: 'some-cluster' },
                logLevel: 'unknown',
                raw: 'This is a previous message 1',
                searchWords: [] as string[],
                timeEpochMs: 1558038519831,
                timeFromNow: 'fromNow() jest mocked',
                timeLocal: 'format() jest mocked',
                timeUtc: 'format() jest mocked',
                timestamp: 1558038519831,
                uniqueLabels: {},
              },
              {
                entry: 'This is a previous message 2',
                fresh: true,
                hasAnsi: false,
                labels: { cluster: 'some-cluster' },
                logLevel: 'unknown',
                raw: 'This is a previous message 2',
                searchWords: [] as string[],
                timeEpochMs: 1558038518831,
                timeFromNow: 'fromNow() jest mocked',
                timeLocal: 'format() jest mocked',
                timeUtc: 'format() jest mocked',
                timestamp: 1558038518831,
                uniqueLabels: {},
              },
            ],
            series: [
              {
                label: 'A-series',
                color: '#7EB26D',
                data: [[1558038518831, 37.91264531864214], [1558038519831, 38.35179822906545]],
                info: undefined,
                isVisible: true,
                yAxis: {
                  index: 1,
                },
              },
            ],
          },
        });

        const theResult = resultProcessor.getLogsResult();
        const expected = {
          hasUniqueLabels: false,
          meta: [] as LogsMetaItem[],
          rows: [
            {
              entry: 'This is a previous message 1',
              fresh: false,
              hasAnsi: false,
              labels: { cluster: 'some-cluster' },
              logLevel: 'unknown',
              raw: 'This is a previous message 1',
              searchWords: [] as string[],
              timeEpochMs: 1558038519831,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              timestamp: 1558038519831,
              uniqueLabels: {},
            },
            {
              entry: 'This is a previous message 2',
              fresh: false,
              hasAnsi: false,
              labels: { cluster: 'some-cluster' },
              logLevel: 'unknown',
              raw: 'This is a previous message 2',
              searchWords: [] as string[],
              timeEpochMs: 1558038518831,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              timestamp: 1558038518831,
              uniqueLabels: {},
            },
            {
              entry: 'third',
              fresh: true,
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'third',
              searchWords: [] as string[],
              timeEpochMs: 300,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              timestamp: 300,
              uniqueLabels: {},
            },
            {
              entry: 'second message',
              fresh: true,
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'second message',
              searchWords: [] as string[],
              timeEpochMs: 200,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              timestamp: 200,
              uniqueLabels: {},
            },
            {
              entry: 'this is a message',
              fresh: true,
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'this is a message',
              searchWords: [] as string[],
              timeEpochMs: 100,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              timestamp: 100,
              uniqueLabels: {},
            },
          ],
          series: [
            {
              label: 'A-series',
              color: '#7EB26D',
              data: [[100, 4], [200, 5], [300, 6]],
              info: undefined,
              isVisible: true,
              yAxis: {
                index: 1,
              },
            } as GraphSeriesXY,
          ],
        };

        expect(theResult).toEqual(expected);
      });
    });
  });
});
