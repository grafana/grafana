import { lastValueFrom } from 'rxjs';

import {
  ArrayVector,
  DataFrame,
  DataQueryRequest,
  FieldColorModeId,
  FieldType,
  LoadingState,
  PanelData,
  TimeRange,
  toDataFrame,
} from '@grafana/data';
import { config } from '@grafana/runtime/src/config';
import { GraphDrawStyle, StackingMode } from '@grafana/schema';
import TableModel from 'app/core/TableModel';
import { ExplorePanelData } from 'app/types';

import {
  decorateWithFrameTypeMetadata,
  decorateWithGraphResult,
  decorateWithLogsResult,
  decorateWithTableResult,
} from './decorators';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  dateTimeFormat: () => 'format() jest mocked',
  dateTimeFormatTimeAgo: (ts: any) => 'fromNow() jest mocked',
}));

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
      { name: 'B-series', type: FieldType.number, values: [7, 8, 9] },
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

  const flameGraph = toDataFrame({
    name: 'flameGraph-res',
    refId: 'A',
    fields: [
      { name: 'level', type: FieldType.number, values: [4, 5, 6] },
      { name: 'value', type: FieldType.number, values: [100, 100, 100] },
      { name: 'self', type: FieldType.number, values: [10, 10, 10] },
      { name: 'label', type: FieldType.string, values: ['this is a message', 'second message', 'third'] },
    ],
    meta: { preferredVisualisationType: 'flamegraph' },
  });

  return { emptyTable, timeSeries, logs, table, flameGraph };
};

const createExplorePanelData = (args: Partial<ExplorePanelData>): ExplorePanelData => {
  const defaults: ExplorePanelData = {
    series: [],
    timeRange: {} as unknown as TimeRange,
    state: LoadingState.Done,
    graphFrames: [],
    graphResult: undefined as unknown as null,
    logsFrames: [],
    logsResult: undefined as unknown as null,
    tableFrames: [],
    tableResult: undefined as unknown as null,
    traceFrames: [],
    nodeGraphFrames: [],
    flameGraphFrames: [],
  };

  return { ...defaults, ...args };
};

describe('decorateWithGraphLogsTraceTableAndFlameGraph', () => {
  it('should correctly classify the dataFrames', () => {
    const { table, logs, timeSeries, emptyTable, flameGraph } = getTestContext();
    const series = [table, logs, timeSeries, emptyTable, flameGraph];
    const panelData: PanelData = {
      series,
      state: LoadingState.Done,
      timeRange: {} as unknown as TimeRange,
    };
    // Needed so flamegraph does not fallback to table, will be removed when feature flag no longer necessary
    config.featureToggles.flameGraph = true;

    expect(decorateWithFrameTypeMetadata(panelData)).toEqual({
      series,
      state: LoadingState.Done,
      timeRange: {},
      graphFrames: [timeSeries],
      tableFrames: [table, emptyTable],
      logsFrames: [logs],
      traceFrames: [],
      nodeGraphFrames: [],
      flameGraphFrames: [flameGraph],
      graphResult: null,
      tableResult: null,
      logsResult: null,
    });
  });

  it('should handle empty array', () => {
    const series: DataFrame[] = [];
    const panelData: PanelData = {
      series,
      state: LoadingState.Done,
      timeRange: {} as unknown as TimeRange,
    };

    expect(decorateWithFrameTypeMetadata(panelData)).toEqual({
      series: [],
      state: LoadingState.Done,
      timeRange: {},
      graphFrames: [],
      tableFrames: [],
      logsFrames: [],
      traceFrames: [],
      nodeGraphFrames: [],
      flameGraphFrames: [],
      graphResult: null,
      tableResult: null,
      logsResult: null,
    });
  });

  it('should return frames even if there is an error', () => {
    const { timeSeries, logs, table } = getTestContext();
    const series: DataFrame[] = [timeSeries, logs, table];
    const panelData: PanelData = {
      series,
      error: {},
      state: LoadingState.Error,
      timeRange: {} as unknown as TimeRange,
    };

    expect(decorateWithFrameTypeMetadata(panelData)).toEqual({
      series: [timeSeries, logs, table],
      error: {},
      state: LoadingState.Error,
      timeRange: {},
      graphFrames: [timeSeries],
      tableFrames: [table],
      logsFrames: [logs],
      traceFrames: [],
      nodeGraphFrames: [],
      flameGraphFrames: [],
      graphResult: null,
      tableResult: null,
      logsResult: null,
    });
  });
});

describe('decorateWithGraphResult', () => {
  it('should process the graph dataFrames', () => {
    const { timeSeries } = getTestContext();
    const panelData = createExplorePanelData({ graphFrames: [timeSeries] });
    expect(decorateWithGraphResult(panelData).graphResult).toMatchObject([timeSeries]);
  });

  it('returns null if it gets empty array', () => {
    const panelData = createExplorePanelData({ graphFrames: [] });
    expect(decorateWithGraphResult(panelData).graphResult).toBeNull();
  });

  it('returns data if panelData has error', () => {
    const { timeSeries } = getTestContext();
    const panelData = createExplorePanelData({ error: {}, graphFrames: [timeSeries] });
    expect(decorateWithGraphResult(panelData).graphResult).toMatchObject([timeSeries]);
  });
});

describe('decorateWithTableResult', () => {
  it('should process table type dataFrame', async () => {
    const { table, emptyTable } = getTestContext();
    const panelData = createExplorePanelData({ tableFrames: [table, emptyTable] });
    const panelResult = await lastValueFrom(decorateWithTableResult(panelData));

    let theResult = panelResult.tableResult;
    let theResultTable = theResult?.[0];

    expect(theResultTable?.fields[0].name).toEqual('value');
    expect(theResultTable?.fields[1].name).toEqual('time');
    expect(theResultTable?.fields[2].name).toEqual('tsNs');
    expect(theResultTable?.fields[3].name).toEqual('message');
    expect(theResultTable?.fields[1].display).not.toBeNull();
    expect(theResultTable?.length).toBe(3);

    // I don't understand the purpose of the code below, feels like this belongs in toDataFrame tests?
    // Same data though a DataFrame
    theResultTable = toDataFrame(
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
    expect(theResultTable.fields[0].name).toEqual('value');
    expect(theResultTable.fields[1].name).toEqual('time');
    expect(theResultTable.fields[2].name).toEqual('tsNs');
    expect(theResultTable.fields[3].name).toEqual('message');
    expect(theResultTable.fields[1].display).not.toBeNull();
    expect(theResultTable.length).toBe(3);
  });

  it('should do join transform if all series are timeseries', async () => {
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
    const panelResult = await lastValueFrom(decorateWithTableResult(panelData));
    const result = panelResult.tableResult;
    const tableResult = result?.[0];

    expect(tableResult?.fields[0].name).toBe('Time');
    expect(tableResult?.fields[1].name).toBe('A-series');
    expect(tableResult?.fields[2].name).toBe('B-series');
    expect(tableResult?.fields[0].values.toArray()).toEqual([100, 200, 300]);
    expect(tableResult?.fields[1].values.toArray()).toEqual([4, 5, 6]);
    expect(tableResult?.fields[2].values.toArray()).toEqual([4, 5, 6]);
  });

  it('should not override fields display property when filled', async () => {
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
    const panelResult = await lastValueFrom(decorateWithTableResult(panelData));
    expect(panelResult.tableResult?.[0]?.fields[0].display).toBe(displayFunctionMock);
  });

  it('should return null when passed empty array', async () => {
    const panelData = createExplorePanelData({ tableFrames: [] });
    const panelResult = await lastValueFrom(decorateWithTableResult(panelData));
    expect(panelResult.tableResult).toBeNull();
  });

  it('returns data if panelData has error', async () => {
    const { table, emptyTable } = getTestContext();
    const panelData = createExplorePanelData({ error: {}, tableFrames: [table, emptyTable] });
    const panelResult = await lastValueFrom(decorateWithTableResult(panelData));
    expect(panelResult.tableResult).not.toBeNull();
  });
});

describe('decorateWithLogsResult', () => {
  it('should correctly transform logs dataFrames', () => {
    const { logs } = getTestContext();
    const request = { timezone: 'utc', intervalMs: 60000 } as unknown as DataQueryRequest;
    const panelData = createExplorePanelData({ logsFrames: [logs], request });
    expect(decorateWithLogsResult()(panelData).logsResult).toEqual({
      hasUniqueLabels: false,
      meta: [],
      rows: [
        {
          rowIndex: 0,
          dataFrame: logs,
          entry: 'this is a message',
          entryFieldIndex: 3,
          hasAnsi: false,
          hasUnescapedContent: false,
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
          hasUnescapedContent: false,
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
          hasUnescapedContent: false,
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
          name: 'unknown',
          length: 1,
          fields: [
            { name: 'Time', type: 'time', values: new ArrayVector([0]), config: {} },
            {
              name: 'Value',
              type: 'number',
              labels: undefined,
              values: new ArrayVector([3]),
              config: {
                color: {
                  fixedColor: '#8e8e8e',
                  mode: FieldColorModeId.Fixed,
                },
                min: 0,
                decimals: 0,
                unit: undefined,
                custom: {
                  drawStyle: GraphDrawStyle.Bars,
                  barAlignment: 0,
                  barMaxWidth: 5,
                  barWidthFactor: 0.9,
                  lineColor: '#8e8e8e',
                  fillColor: '#8e8e8e',
                  pointColor: '#8e8e8e',
                  lineWidth: 0,
                  fillOpacity: 100,
                  stacking: { mode: StackingMode.Normal, group: 'A' },
                },
              },
            },
          ],
        },
      ],
      visibleRange: undefined,
    });
  });

  it('returns null if passed empty array', () => {
    const panelData = createExplorePanelData({ logsFrames: [] });
    expect(decorateWithLogsResult()(panelData).logsResult).toBeNull();
  });

  it('returns data if panelData has error', () => {
    const { logs } = getTestContext();
    const panelData = createExplorePanelData({ error: {}, logsFrames: [logs] });
    expect(decorateWithLogsResult()(panelData).logsResult).not.toBeNull();
  });
});
