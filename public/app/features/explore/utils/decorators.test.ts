jest.mock('@grafana/data/src/datetime/formatter', () => ({
  dateTimeFormat: () => 'format() jest mocked',
  dateTimeFormatTimeAgo: (ts: any) => 'fromNow() jest mocked',
}));

import { of } from 'rxjs';
import {
  ArrayVector,
  DataFrame,
  DataQueryRequest,
  DataSourceApi,
  FieldType,
  LoadingState,
  observableTester,
  PanelData,
  TimeRange,
  toDataFrame,
} from '@grafana/data';

import {
  decorateWithGraphLogsTraceAndTable,
  decorateWithGraphResult,
  decorateWithLogsResult,
  decorateWithTableResult,
} from './decorators';
import { describe } from '../../../../test/lib/common';
import { ExploreItemState, ExplorePanelData } from 'app/types';
import TableModel from 'app/core/table_model';

const getTestContext = () => {
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

  return { emptyTable, timeSeries, logs, table };
};

const createExplorePanelData = (args: Partial<ExplorePanelData>): ExplorePanelData => {
  const defaults: ExplorePanelData = {
    series: [],
    timeRange: ({} as unknown) as TimeRange,
    state: LoadingState.Done,
    graphFrames: [],
    graphResult: (undefined as unknown) as null,
    logsFrames: [],
    logsResult: (undefined as unknown) as null,
    tableFrames: [],
    tableResult: (undefined as unknown) as null,
    traceFrames: [],
  };

  return { ...defaults, ...args };
};

describe('decorateWithGraphLogsTraceAndTable', () => {
  describe('when used without error', () => {
    it('then the result should be correct', done => {
      const { table, logs, timeSeries, emptyTable } = getTestContext();
      const datasourceInstance = ({ meta: { id: 'prometheus' } } as unknown) as DataSourceApi;
      const series = [table, logs, timeSeries, emptyTable];
      const panelData: PanelData = {
        series,
        state: LoadingState.Done,
        timeRange: ({} as unknown) as TimeRange,
      };

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithGraphLogsTraceAndTable(datasourceInstance)),
        expect: value => {
          expect(value).toEqual({
            series,
            state: LoadingState.Done,
            timeRange: {},
            graphFrames: [timeSeries],
            tableFrames: [table, emptyTable],
            logsFrames: [logs],
            traceFrames: [],
            graphResult: null,
            tableResult: null,
            logsResult: null,
          });
        },
        done,
      });
    });
  });

  describe('when used without frames', () => {
    it('then the result should be correct', done => {
      const datasourceInstance = ({ meta: { id: 'prometheus' } } as unknown) as DataSourceApi;
      const series: DataFrame[] = [];
      const panelData: PanelData = {
        series,
        state: LoadingState.Done,
        timeRange: ({} as unknown) as TimeRange,
      };

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithGraphLogsTraceAndTable(datasourceInstance)),
        expect: value => {
          expect(value).toEqual({
            series: [],
            state: LoadingState.Done,
            timeRange: {},
            graphFrames: [],
            tableFrames: [],
            logsFrames: [],
            traceFrames: [],
            graphResult: null,
            tableResult: null,
            logsResult: null,
          });
        },
        done,
      });
    });
  });

  describe('when used with an error', () => {
    it('then the result should be correct', done => {
      const { timeSeries, logs, table } = getTestContext();
      const datasourceInstance = ({ meta: { id: 'prometheus' } } as unknown) as DataSourceApi;
      const series: DataFrame[] = [timeSeries, logs, table];
      const panelData: PanelData = {
        series,
        error: {},
        state: LoadingState.Error,
        timeRange: ({} as unknown) as TimeRange,
      };

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithGraphLogsTraceAndTable(datasourceInstance)),
        expect: value => {
          expect(value).toEqual({
            series: [timeSeries, logs, table],
            error: {},
            state: LoadingState.Error,
            timeRange: {},
            graphFrames: [],
            tableFrames: [],
            logsFrames: [],
            traceFrames: [],
            graphResult: null,
            tableResult: null,
            logsResult: null,
          });
        },
        done,
      });
    });
  });
});

describe('decorateWithGraphResult', () => {
  describe('when used without error', () => {
    it('then the graphResult should be correct', done => {
      const { timeSeries } = getTestContext();
      const timeField = timeSeries.fields[0];
      const valueField = timeSeries.fields[1];
      const panelData = createExplorePanelData({ graphFrames: [timeSeries] });

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithGraphResult()),
        expect: panelData => {
          expect(panelData.graphResult![0]).toEqual({
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
        },
        done,
      });
    });
  });

  describe('when used without error but graph frames are empty', () => {
    it('then the graphResult should be null', done => {
      const panelData = createExplorePanelData({ graphFrames: [] });

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithGraphResult()),
        expect: panelData => {
          expect(panelData.graphResult).toBeNull();
        },
        done,
      });
    });
  });

  describe('when used with error', () => {
    it('then the graphResult should be null', done => {
      const { timeSeries } = getTestContext();
      const panelData = createExplorePanelData({ error: {}, graphFrames: [timeSeries] });

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithGraphResult()),
        expect: panelData => {
          expect(panelData.graphResult).toBeNull();
        },
        done,
      });
    });
  });
});

describe('decorateWithTableResult', () => {
  describe('when used without error', () => {
    it('then the tableResult should be correct', done => {
      const { table, emptyTable } = getTestContext();
      const panelData = createExplorePanelData({ tableFrames: [table, emptyTable] });

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithTableResult()),
        expect: panelData => {
          let theResult = panelData.tableResult;

          expect(theResult?.fields[0].name).toEqual('value');
          expect(theResult?.fields[1].name).toEqual('time');
          expect(theResult?.fields[2].name).toEqual('tsNs');
          expect(theResult?.fields[3].name).toEqual('message');
          expect(theResult?.fields[1].display).not.toBeNull();
          expect(theResult?.length).toBe(3);

          // I don't understand the purpose of the code below, feels like this belongs in toDataFrame tests?
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
        },
        done,
      });
    });

    it('should do join transform if all series are timeseries', done => {
      const tableFrames = [
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
      ];
      const panelData = createExplorePanelData({ tableFrames });

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithTableResult()),
        expect: panelData => {
          const result = panelData.tableResult;

          expect(result?.fields[0].name).toBe('Time');
          expect(result?.fields[1].name).toBe('A-series');
          expect(result?.fields[2].name).toBe('B-series');
          expect(result?.fields[0].values.toArray()).toEqual([100, 200, 300]);
          expect(result?.fields[1].values.toArray()).toEqual([4, 5, 6]);
          expect(result?.fields[2].values.toArray()).toEqual([4, 5, 6]);
        },
        done,
      });
    });

    it('should not override fields display property when filled', done => {
      const tableFrames = [
        toDataFrame({
          name: 'A-series',
          refId: 'A',
          fields: [{ name: 'Text', type: FieldType.string, values: ['someText'] }],
        }),
      ];
      const displayFunctionMock = jest.fn();
      tableFrames[0].fields[0].display = displayFunctionMock;

      const panelData = createExplorePanelData({ tableFrames });

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithTableResult()),
        expect: panelData => {
          const data = panelData.tableResult;
          expect(data?.fields[0].display).toBe(displayFunctionMock);
        },
        done,
      });
    });
  });

  describe('when used without error but table frames are empty', () => {
    it('then the tableResult should be null', done => {
      const panelData = createExplorePanelData({ tableFrames: [] });

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithTableResult()),
        expect: panelData => {
          expect(panelData.tableResult).toBeNull();
        },
        done,
      });
    });
  });

  describe('when used with error', () => {
    it('then the tableResult should be null', done => {
      const { table, emptyTable } = getTestContext();
      const panelData = createExplorePanelData({ error: {}, tableFrames: [table, emptyTable] });

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithTableResult()),
        expect: panelData => {
          expect(panelData.tableResult).toBeNull();
        },
        done,
      });
    });
  });
});

describe('decorateWithLogsResult', () => {
  describe('when used without error', () => {
    it('then the logsResult should be correct', done => {
      const { logs } = getTestContext();
      const state = ({
        queryIntervals: { intervalMs: 10 },
      } as unknown) as ExploreItemState;
      const request = ({ timezone: 'utc', intervalMs: 60000 } as unknown) as DataQueryRequest;
      const panelData = createExplorePanelData({ logsFrames: [logs], request });

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithLogsResult(state)),
        expect: panelData => {
          const theResult = panelData.logsResult;

          expect(theResult).toEqual({
            hasUniqueLabels: false,
            meta: [],
            rows: [
              {
                rowIndex: 0,
                dataFrame: logs,
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
                dataFrame: logs,
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
                dataFrame: logs,
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
        },
        done,
      });
    });
  });

  describe('when used without error but logs frames are empty', () => {
    it('then the graphResult should be null', done => {
      const panelData = createExplorePanelData({ logsFrames: [] });
      const state = ({} as unknown) as ExploreItemState;

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithLogsResult(state)),
        expect: panelData => {
          expect(panelData.logsResult).toBeNull();
        },
        done,
      });
    });
  });

  describe('when used with error', () => {
    it('then the graphResult should be null', done => {
      const { logs } = getTestContext();
      const panelData = createExplorePanelData({ error: {}, logsFrames: [logs] });
      const state = ({} as unknown) as ExploreItemState;

      observableTester().subscribeAndExpectOnNext({
        observable: of(panelData).pipe(decorateWithLogsResult(state)),
        expect: panelData => {
          expect(panelData.logsResult).toBeNull();
        },
        done,
      });
    });
  });
});
