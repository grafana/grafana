jest.mock('@grafana/data/src/datetime/formatter', () => ({
  dateTimeFormat: () => 'format() jest mocked',
  dateTimeFormatTimeAgo: (ts: any) => 'fromNow() jest mocked',
}));

import { ResultProcessor } from './ResultProcessor';
import { ExploreItemState } from 'app/types/explore';
import TableModel from 'app/core/table_model';
import { FieldType, LogRowModel, TimeSeries, toDataFrame, ArrayVector } from '@grafana/data';

const testContext = (options: any = {}) => {
  const timeSeries = toDataFrame({
    name: 'A-series',
    refId: 'A',
    meta: {
      preferredVisualisationType: 'graph',
    },
    fields: [
      { name: 'time', type: FieldType.time, values: [100, 200, 300] },
      { name: 'A-series', type: FieldType.number, values: [4, 5, 6] },
    ],
  });

  const table = toDataFrame({
    name: 'table-res',
    refId: 'A',
    fields: [
      { name: 'value', type: FieldType.number, values: [4, 5, 6] },
      { name: 'time', type: FieldType.time, values: [100, 100, 100] },
      { name: 'tsNs', type: FieldType.time, values: ['100000002', undefined, '100000001'] },
      { name: 'message', type: FieldType.string, values: ['this is a message', 'second message', 'third'] },
    ],
  });

  const emptyTable = toDataFrame({ name: 'empty-table', refId: 'A', fields: [] });

  const logs = toDataFrame({
    name: 'logs-res',
    refId: 'A',
    fields: [
      { name: 'value', type: FieldType.number, values: [4, 5, 6] },
      { name: 'time', type: FieldType.time, values: [100, 100, 100] },
      { name: 'tsNs', type: FieldType.time, values: ['100000002', undefined, '100000001'] },
      { name: 'message', type: FieldType.string, values: ['this is a message', 'second message', 'third'] },
    ],
    meta: { preferredVisualisationType: 'logs' },
  });

  const defaultOptions = {
    dataFrames: [timeSeries, table, emptyTable, logs],
    graphResult: [] as TimeSeries[],
    tableResult: new TableModel(),
    logsResult: { hasUniqueLabels: false, rows: [] as LogRowModel[] },
  };

  const combinedOptions = { ...defaultOptions, ...options };

  const state = ({
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
        const timeField = dataFrames[0].fields[0];
        const valueField = dataFrames[0].fields[1];
        const theResult = resultProcessor.getGraphResult();

        expect(theResult![0]).toEqual({
          label: 'A-series',
          color: '#7EB26D',
          data: [
            [100, 4],
            [200, 5],
            [300, 6],
          ],
          info: [],
          isVisible: true,
          yAxis: {
            index: 1,
          },
          seriesIndex: 0,
          timeField,
          valueField,
          timeStep: 100,
        });
      });
    });

    describe('when calling getTableResult', () => {
      it('then it should return correct table result', () => {
        const { resultProcessor } = testContext();
        let theResult = resultProcessor.getTableResult();

        expect(theResult?.fields[0].name).toEqual('value');
        expect(theResult?.fields[1].name).toEqual('time');
        expect(theResult?.fields[2].name).toEqual('tsNs');
        expect(theResult?.fields[3].name).toEqual('message');
        expect(theResult?.fields[1].display).not.toBeNull();
        expect(theResult?.length).toBe(3);

        // Same data though a DataFrame
        theResult = toDataFrame(
          new TableModel({
            columns: [
              { text: 'value', type: 'number' },
              { text: 'time', type: 'time' },
              { text: 'tsNs', type: 'time' },
              { text: 'message', type: 'string' },
            ],
            rows: [
              [4, 100, '100000000', 'this is a message'],
              [5, 200, '100000000', 'second message'],
              [6, 300, '100000000', 'third'],
            ],
            type: 'table',
          })
        );
        expect(theResult.fields[0].name).toEqual('value');
        expect(theResult.fields[1].name).toEqual('time');
        expect(theResult.fields[2].name).toEqual('tsNs');
        expect(theResult.fields[3].name).toEqual('message');
        expect(theResult.fields[1].display).not.toBeNull();
        expect(theResult.length).toBe(3);
      });

      it('should do join transform if all series are timeseries', () => {
        const { resultProcessor } = testContext({
          dataFrames: [
            toDataFrame({
              name: 'A-series',
              refId: 'A',
              fields: [
                { name: 'Time', type: FieldType.time, values: [100, 200, 300] },
                { name: 'A-series', type: FieldType.number, values: [4, 5, 6] },
              ],
            }),
            toDataFrame({
              name: 'B-series',
              refId: 'B',
              fields: [
                { name: 'Time', type: FieldType.time, values: [100, 200, 300] },
                { name: 'B-series', type: FieldType.number, values: [4, 5, 6] },
              ],
            }),
          ],
        });

        let result = resultProcessor.getTableResult()!;

        expect(result.fields[0].name).toBe('Time');
        expect(result.fields[1].name).toBe('A-series');
        expect(result.fields[2].name).toBe('B-series');
        expect(result.fields[0].values.toArray()).toEqual([100, 200, 300]);
        expect(result.fields[1].values.toArray()).toEqual([4, 5, 6]);
        expect(result.fields[2].values.toArray()).toEqual([4, 5, 6]);
      });

      it('should not override fields display property when filled', () => {
        const { resultProcessor, dataFrames } = testContext({
          dataFrames: [
            toDataFrame({
              name: 'A-series',
              refId: 'A',
              fields: [{ name: 'Text', type: FieldType.string, values: ['someText'] }],
            }),
          ],
        });
        const displayFunctionMock = jest.fn();
        dataFrames[0].fields[0].display = displayFunctionMock;

        const data = resultProcessor.getTableResult();

        expect(data?.fields[0].display).toBe(displayFunctionMock);
      });
    });

    describe('when calling getLogsResult', () => {
      it('then it should return correct logs result', () => {
        const { resultProcessor, dataFrames } = testContext({});
        const logsDataFrame = dataFrames[3];

        const theResult = resultProcessor.getLogsResult();

        expect(theResult).toEqual({
          hasUniqueLabels: false,
          meta: [],
          rows: [
            {
              rowIndex: 0,
              dataFrame: logsDataFrame,
              entry: 'this is a message',
              entryFieldIndex: 3,
              hasAnsi: false,
              labels: {},
              logLevel: 'unknown',
              raw: 'this is a message',
              searchWords: [] as string[],
              timeEpochMs: 100,
              timeEpochNs: '100000002',
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              uid: '0',
              uniqueLabels: {},
            },
            {
              rowIndex: 2,
              dataFrame: logsDataFrame,
              entry: 'third',
              entryFieldIndex: 3,
              hasAnsi: false,
              labels: {},
              logLevel: 'unknown',
              raw: 'third',
              searchWords: [] as string[],
              timeEpochMs: 100,
              timeEpochNs: '100000001',
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
              entryFieldIndex: 3,
              hasAnsi: false,
              labels: {},
              logLevel: 'unknown',
              raw: 'second message',
              searchWords: [] as string[],
              timeEpochMs: 100,
              timeEpochNs: '100000000',
              timeFromNow: 'fromNow() jest mocked',
              timeLocal: 'format() jest mocked',
              timeUtc: 'format() jest mocked',
              uid: '1',
              uniqueLabels: {},
            },
          ],
          series: [
            {
              label: 'unknown',
              color: '#8e8e8e',
              data: [[0, 3]],
              isVisible: true,
              yAxis: {
                index: 1,
                min: 0,
                tickDecimals: 0,
              },
              seriesIndex: 0,
              timeField: {
                name: 'Time',
                type: 'time',
                config: {},
                values: new ArrayVector([0]),
                index: 0,
                display: expect.anything(),
              },
              valueField: {
                name: 'unknown',
                type: 'number',
                config: { unit: undefined, color: '#8e8e8e' },
                values: new ArrayVector([3]),
                labels: undefined,
                index: 1,
                display: expect.anything(),
              },
              timeStep: 0,
            },
          ],
          visibleRange: undefined,
        });
      });
    });
  });
});
