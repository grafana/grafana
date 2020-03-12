jest.mock('@grafana/data/src/datetime/moment_wrapper', () => ({
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
import { ExploreItemState } from 'app/types/explore';
import TableModel from 'app/core/table_model';
import { ExploreMode, FieldType, LogRowModel, TimeSeries, toDataFrame } from '@grafana/data';

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

  const emptyTable = toDataFrame({ name: 'empty-table', refId: 'A', fields: [] });

  const defaultOptions = {
    mode: ExploreMode.Metrics,
    dataFrames: [timeSeries, table, emptyTable],
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

  const resultProcessor = new ResultProcessor(state, combinedOptions.dataFrames, 60000, 'utc');

  return {
    dataFrames: combinedOptions.dataFrames,
    resultProcessor,
  };
};

describe('ResultProcessor', () => {
  describe('constructed without result', () => {
    describe('when calling getGraphResult', () => {
      it('then it should return null', () => {
        const { resultProcessor } = testContext({ dataFrames: [] });
        const theResult = resultProcessor.getGraphResult();

        expect(theResult).toEqual(null);
      });
    });

    describe('when calling getTableResult', () => {
      it('then it should return null', () => {
        const { resultProcessor } = testContext({ dataFrames: [] });
        const theResult = resultProcessor.getTableResult();

        expect(theResult).toEqual(null);
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
        const { resultProcessor, dataFrames } = testContext();
        const timeField = dataFrames[0].fields[1];
        const valueField = dataFrames[0].fields[0];
        const theResult = resultProcessor.getGraphResult();

        expect(theResult).toEqual([
          {
            label: 'A-series',
            color: '#7EB26D',
            data: [
              [100, 4],
              [200, 5],
              [300, 6],
            ],
            info: undefined,
            isVisible: true,
            yAxis: {
              index: 1,
            },
            seriesIndex: 0,
            timeField,
            valueField,
            timeStep: 100,
          },
        ]);
      });
    });

    describe('when calling getTableResult', () => {
      it('then it should return correct table result', () => {
        const { resultProcessor } = testContext();
        let theResult = resultProcessor.getTableResult();
        expect(theResult?.fields[0].name).toEqual('value');
        expect(theResult?.fields[1].name).toEqual('time');
        expect(theResult?.fields[2].name).toEqual('message');
        expect(theResult?.fields[1].display).not.toBeNull();
        expect(theResult?.length).toBe(3);

        // Same data though a DataFrame
        theResult = toDataFrame(
          new TableModel({
            columns: [
              { text: 'value', type: 'number' },
              { text: 'time', type: 'time' },
              { text: 'message', type: 'string' },
            ],
            rows: [
              [4, 100, 'this is a message'],
              [5, 200, 'second message'],
              [6, 300, 'third'],
            ],
            type: 'table',
          })
        );
        expect(theResult.fields[0].name).toEqual('value');
        expect(theResult.fields[1].name).toEqual('time');
        expect(theResult.fields[2].name).toEqual('message');
        expect(theResult.fields[1].display).not.toBeNull();
        expect(theResult.length).toBe(3);
      });
    });

    describe('when calling getLogsResult', () => {
      it('then it should return correct logs result', () => {
        const { resultProcessor, dataFrames } = testContext({ mode: ExploreMode.Logs });
        const timeField = dataFrames[0].fields[1];
        const valueField = dataFrames[0].fields[0];
        const logsDataFrame = dataFrames[1];
        const theResult = resultProcessor.getLogsResult();

        expect(theResult).toEqual({
          hasUniqueLabels: false,
          meta: [],
          rows: [
            {
              rowIndex: 2,
              dataFrame: logsDataFrame,
              entry: 'third',
              entryFieldIndex: 2,
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'third',
              searchWords: [] as string[],
              timeEpochMs: 300,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              uid: '2',
              uniqueLabels: {},
            },
            {
              rowIndex: 1,
              dataFrame: logsDataFrame,
              entry: 'second message',
              entryFieldIndex: 2,
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'second message',
              searchWords: [] as string[],
              timeEpochMs: 200,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              uid: '1',
              uniqueLabels: {},
            },
            {
              rowIndex: 0,
              dataFrame: logsDataFrame,
              entry: 'this is a message',
              entryFieldIndex: 2,
              hasAnsi: false,
              labels: undefined,
              logLevel: 'unknown',
              raw: 'this is a message',
              searchWords: [] as string[],
              timeEpochMs: 100,
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              uid: '0',
              uniqueLabels: {},
            },
          ],
          series: [
            {
              label: 'A-series',
              color: '#7EB26D',
              data: [
                [100, 4],
                [200, 5],
                [300, 6],
              ],
              info: undefined,
              isVisible: true,
              yAxis: {
                index: 1,
              },
              seriesIndex: 0,
              timeField,
              valueField,
              timeStep: 100,
            },
          ],
        });
      });
    });
  });
});
