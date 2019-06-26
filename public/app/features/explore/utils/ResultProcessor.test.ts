jest.mock('@grafana/ui/src/utils/moment_wrapper', () => ({
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
import { toFixed, TimeSeries, LogRowModel, LogsMetaItem } from '@grafana/ui';

const testContext = (options: any = {}) => {
  const response = [
    {
      target: 'A-series',
      alias: 'A-series',
      datapoints: [[39.91264531864214, 1559038518831], [40.35179822906545, 1559038519831]],
      refId: 'A',
    },
    {
      columns: [
        {
          text: 'Time',
        },
        {
          text: 'Message',
        },
        {
          text: 'Description',
        },
        {
          text: 'Value',
        },
      ],
      rows: [
        [1559038518831, 'This is a message', 'Description', 23.1],
        [1559038519831, 'This is a message', 'Description', 23.1],
      ],
      refId: 'B',
    },
  ];
  const defaultOptions = {
    mode: ExploreMode.Metrics,
    replacePreviousResults: true,
    result: { data: response },
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
  const resultProcessor = new ResultProcessor(state, combinedOptions.replacePreviousResults, combinedOptions.result);

  return {
    result: combinedOptions.result,
    resultProcessor,
  };
};

describe('ResultProcessor', () => {
  describe('constructed without result', () => {
    describe('when calling getRawData', () => {
      it('then it should return an empty array', () => {
        const { resultProcessor } = testContext({ result: null });
        const theResult = resultProcessor.getRawData();

        expect(theResult).toEqual([]);
      });
    });

    describe('when calling getGraphResult', () => {
      it('then it should return an empty array', () => {
        const { resultProcessor } = testContext({ result: null });
        const theResult = resultProcessor.getGraphResult();

        expect(theResult).toEqual([]);
      });
    });

    describe('when calling getTableResult', () => {
      it('then it should return an empty TableModel', () => {
        const { resultProcessor } = testContext({ result: null });
        const theResult = resultProcessor.getTableResult();

        expect(theResult).toEqual(new TableModel());
      });
    });

    describe('when calling getLogsResult', () => {
      it('then it should return null', () => {
        const { resultProcessor } = testContext({ result: null });
        const theResult = resultProcessor.getLogsResult();

        expect(theResult).toBeNull();
      });
    });
  });

  describe('constructed with a result that is a DataQueryResponse', () => {
    describe('when calling getRawData', () => {
      it('then it should return result.data', () => {
        const { result, resultProcessor } = testContext();
        const theResult = resultProcessor.getRawData();

        expect(theResult).toEqual(result.data);
      });
    });

    describe('when calling getGraphResult', () => {
      it('then it should return correct graph result', () => {
        const { resultProcessor } = testContext();
        const theResult = resultProcessor.getGraphResult();

        expect(theResult).toEqual([
          {
            alias: 'A-series',
            aliasEscaped: 'A-series',
            bars: {
              fillColor: '#7EB26D',
            },
            hasMsResolution: true,
            id: 'A-series',
            label: 'A-series',
            legend: true,
            stats: {},
            color: '#7EB26D',
            datapoints: [[39.91264531864214, 1559038518831], [40.35179822906545, 1559038519831]],
            unit: undefined,
            valueFormater: toFixed,
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
          columns: [{ text: 'Time' }, { text: 'Message' }, { text: 'Description' }, { text: 'Value' }],
          rows: [
            [1559038518831, 'This is a message', 'Description', 23.1],
            [1559038519831, 'This is a message', 'Description', 23.1],
          ],
          type: 'table',
        });
      });
    });

    describe('when calling getLogsResult', () => {
      it('then it should return correct logs result', () => {
        const { resultProcessor } = testContext({ mode: ExploreMode.Logs, observerResponse: null });
        const theResult = resultProcessor.getLogsResult();

        expect(theResult).toEqual({
          hasUniqueLabels: false,
          meta: [],
          rows: [
            {
              entry: 'This is a message',
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'This is a message',
              searchWords: [] as string[],
              timeEpochMs: 1559038519831,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              timestamp: 1559038519831,
              uniqueLabels: {},
            },
            {
              entry: 'This is a message',
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'This is a message',
              searchWords: [] as string[],
              timeEpochMs: 1559038518831,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              timestamp: 1559038518831,
              uniqueLabels: {},
            },
          ],
          series: [
            {
              alias: 'A-series',
              datapoints: [[39.91264531864214, 1559038518831], [40.35179822906545, 1559038519831]],
              meta: undefined,
              refId: 'A',
              target: 'A-series',
              unit: undefined,
            },
          ],
        });
      });
    });
  });

  describe('constructed with result that is a DataQueryResponse and merging with previous results', () => {
    describe('when calling getRawData', () => {
      it('then it should return result.data', () => {
        const { result, resultProcessor } = testContext();
        const theResult = resultProcessor.getRawData();

        expect(theResult).toEqual(result.data);
      });
    });

    describe('when calling getGraphResult', () => {
      it('then it should return correct graph result', () => {
        const { resultProcessor } = testContext({
          replacePreviousResults: false,
          graphResult: [
            {
              alias: 'A-series',
              aliasEscaped: 'A-series',
              bars: {
                fillColor: '#7EB26D',
              },
              hasMsResolution: true,
              id: 'A-series',
              label: 'A-series',
              legend: true,
              stats: {},
              color: '#7EB26D',
              datapoints: [[19.91264531864214, 1558038518831], [20.35179822906545, 1558038519831]],
              unit: undefined,
              valueFormater: toFixed,
            },
          ],
        });
        const theResult = resultProcessor.getGraphResult();

        expect(theResult).toEqual([
          {
            alias: 'A-series',
            aliasEscaped: 'A-series',
            bars: {
              fillColor: '#7EB26D',
            },
            hasMsResolution: true,
            id: 'A-series',
            label: 'A-series',
            legend: true,
            stats: {},
            color: '#7EB26D',
            datapoints: [
              [19.91264531864214, 1558038518831],
              [20.35179822906545, 1558038519831],
              [39.91264531864214, 1559038518831],
              [40.35179822906545, 1559038519831],
            ],
            unit: undefined,
            valueFormater: toFixed,
          },
        ]);
      });
    });

    describe('when calling getTableResult', () => {
      it('then it should return correct table result', () => {
        const { resultProcessor } = testContext({
          replacePreviousResults: false,
          tableResult: {
            columnMap: {},
            columns: [{ text: 'Time' }, { text: 'Message' }, { text: 'Description' }, { text: 'Value' }],
            rows: [
              [1558038518831, 'This is a previous message 1', 'Previous Description 1', 21.1],
              [1558038519831, 'This is a previous message 2', 'Previous Description 2', 22.1],
            ],
            type: 'table',
          },
        });
        const theResult = resultProcessor.getTableResult();

        expect(theResult).toEqual({
          columnMap: {},
          columns: [{ text: 'Time' }, { text: 'Message' }, { text: 'Description' }, { text: 'Value' }],
          rows: [
            [1558038518831, 'This is a previous message 1', 'Previous Description 1', 21.1],
            [1558038519831, 'This is a previous message 2', 'Previous Description 2', 22.1],
            [1559038518831, 'This is a message', 'Description', 23.1],
            [1559038519831, 'This is a message', 'Description', 23.1],
          ],
          type: 'table',
        });
      });
    });

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
                alias: 'A-series',
                aliasEscaped: 'A-series',
                bars: {
                  fillColor: '#7EB26D',
                },
                hasMsResolution: true,
                id: 'A-series',
                label: 'A-series',
                legend: true,
                stats: {},
                color: '#7EB26D',
                datapoints: [[37.91264531864214, 1558038518831], [38.35179822906545, 1558038519831]],
                unit: undefined,
                valueFormater: toFixed,
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
              entry: 'This is a message',
              fresh: true,
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'This is a message',
              searchWords: [] as string[],
              timeEpochMs: 1559038519831,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              timestamp: 1559038519831,
              uniqueLabels: {},
            },
            {
              entry: 'This is a message',
              fresh: true,
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'This is a message',
              searchWords: [] as string[],
              timeEpochMs: 1559038518831,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              timestamp: 1559038518831,
              uniqueLabels: {},
            },
          ],
          series: [
            {
              alias: 'A-series',
              aliasEscaped: 'A-series',
              bars: {
                fillColor: '#7EB26D',
              },
              hasMsResolution: true,
              id: 'A-series',
              label: 'A-series',
              legend: true,
              stats: {},
              color: '#7EB26D',
              datapoints: [
                [37.91264531864214, 1558038518831],
                [38.35179822906545, 1558038519831],
                [39.91264531864214, 1559038518831],
                [40.35179822906545, 1559038519831],
              ],
              unit: undefined as string,
              valueFormater: toFixed,
            },
          ],
        };

        expect(theResult).toEqual(expected);
      });
    });
  });
});
