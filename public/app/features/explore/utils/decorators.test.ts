import { lastValueFrom } from 'rxjs';

import {
  DataFrame,
  FieldType,
  LoadingState,
  PanelData,
  getDefaultTimeRange,
  toDataFrame,
  DataSourceApi,
  DataSourceInstanceSettings,
} from '@grafana/data';
import { CorrelationData } from '@grafana/runtime';
import { DataSourceJsonData, DataQuery } from '@grafana/schema';
import TableModel from 'app/core/TableModel';
import { ExplorePanelData } from 'app/types';

import {
  decorateWithCorrelations,
  decorateWithFrameTypeMetadata,
  decorateWithGraphResult,
  decorateWithLogsResult,
  decorateWithTableResult,
} from './decorators';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  dateTimeFormat: () => 'format() jest mocked',
  dateTimeFormatTimeAgo: () => 'fromNow() jest mocked',
}));

jest.mock('../../plugins/importPanelPlugin', () => {
  const actual = jest.requireActual('../../plugins/importPanelPlugin');
  return {
    ...actual,
    hasPanelPlugin: (id: string) => {
      return id === 'someCustomPanelPlugin';
    },
  };
});

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
    timeRange: getDefaultTimeRange(),
    state: LoadingState.Done,
    graphFrames: [],
    graphResult: null,
    logsFrames: [],
    logsResult: null,
    tableFrames: [],
    tableResult: null,
    traceFrames: [],
    nodeGraphFrames: [],
    customFrames: [],
    flameGraphFrames: [],
    rawPrometheusFrames: [],
    rawPrometheusResult: null,
  };

  return { ...defaults, ...args };
};

const datasource = {
  name: 'testDs',
  type: 'postgres',
  uid: 'ds1',
  getRef: () => {
    return { type: 'postgres', uid: 'ds1' };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const datasourceInstance = {
  name: datasource.name,
  id: 1,
  uid: datasource.uid,
  type: datasource.type,
  jsonData: {},
} as DataSourceInstanceSettings<DataSourceJsonData>;

describe('decorateWithGraphLogsTraceTableAndFlameGraph', () => {
  it('should correctly classify the dataFrames', () => {
    const { table, logs, timeSeries, emptyTable, flameGraph } = getTestContext();
    const series = [table, logs, timeSeries, emptyTable, flameGraph];
    const timeRange = getDefaultTimeRange();
    const panelData: PanelData = {
      series,
      state: LoadingState.Done,
      timeRange,
    };

    expect(decorateWithFrameTypeMetadata(panelData)).toEqual({
      series,
      state: LoadingState.Done,
      timeRange,
      graphFrames: [timeSeries],
      tableFrames: [table, emptyTable],
      logsFrames: [logs],
      traceFrames: [],
      customFrames: [],
      nodeGraphFrames: [],
      flameGraphFrames: [flameGraph],
      graphResult: null,
      tableResult: null,
      logsResult: null,
      rawPrometheusFrames: [],
      rawPrometheusResult: null,
    });
  });

  it('should handle empty array', () => {
    const series: DataFrame[] = [];
    const timeRange = getDefaultTimeRange();
    const panelData: PanelData = {
      series,
      state: LoadingState.Done,
      timeRange,
    };

    expect(decorateWithFrameTypeMetadata(panelData)).toEqual({
      series: [],
      state: LoadingState.Done,
      timeRange: timeRange,
      graphFrames: [],
      tableFrames: [],
      logsFrames: [],
      traceFrames: [],
      nodeGraphFrames: [],
      customFrames: [],
      flameGraphFrames: [],
      graphResult: null,
      tableResult: null,
      logsResult: null,
      rawPrometheusFrames: [],
      rawPrometheusResult: null,
    });
  });

  it('should return frames even if there is an error', () => {
    const { timeSeries, logs, table } = getTestContext();
    const series: DataFrame[] = [timeSeries, logs, table];
    const timeRange = getDefaultTimeRange();
    const panelData: PanelData = {
      series,
      error: {},
      state: LoadingState.Error,
      timeRange,
    };

    expect(decorateWithFrameTypeMetadata(panelData)).toEqual({
      series: [timeSeries, logs, table],
      error: {},
      state: LoadingState.Error,
      timeRange,
      graphFrames: [timeSeries],
      tableFrames: [table],
      logsFrames: [logs],
      traceFrames: [],
      nodeGraphFrames: [],
      customFrames: [],
      flameGraphFrames: [],
      graphResult: null,
      tableResult: null,
      logsResult: null,
      rawPrometheusFrames: [],
      rawPrometheusResult: null,
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
    expect(tableResult?.fields[0].values).toEqual([100, 200, 300]);
    expect(tableResult?.fields[1].values).toEqual([4, 5, 6]);
    expect(tableResult?.fields[2].values).toEqual([4, 5, 6]);
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

describe('decorateWithCustomFrames', () => {
  it('returns empty array if no custom frames', () => {
    const { table, logs, timeSeries, emptyTable, flameGraph } = getTestContext();
    const series = [table, logs, timeSeries, emptyTable, flameGraph];
    const timeRange = getDefaultTimeRange();
    const panelData: PanelData = {
      series,
      state: LoadingState.Done,
      timeRange,
    };

    expect(decorateWithFrameTypeMetadata(panelData).customFrames).toEqual([]);
  });
  it('returns data if we have custom frames', () => {
    const { table, logs, timeSeries, emptyTable, flameGraph } = getTestContext();
    const customFrame = toDataFrame({
      name: 'custom-panel',
      refId: 'A',
      fields: [],
      meta: { preferredVisualisationType: 'table', preferredVisualisationPluginId: 'someCustomPanelPlugin' },
    });

    const series = [table, logs, timeSeries, emptyTable, flameGraph, customFrame];
    const timeRange = getDefaultTimeRange();
    const panelData: PanelData = {
      series,
      state: LoadingState.Done,
      timeRange,
    };

    expect(decorateWithFrameTypeMetadata(panelData).customFrames).toEqual([customFrame]);
  });
});

describe('decorateWithCorrelations', () => {
  it('returns no links if there are no correlations and no editor links', () => {
    const { table, logs, timeSeries, emptyTable, flameGraph } = getTestContext();
    const series = [table, logs, timeSeries, emptyTable, flameGraph];
    const timeRange = getDefaultTimeRange();
    const panelData: PanelData = {
      series,
      state: LoadingState.Done,
      timeRange,
    };
    const postDecoratedPanel = decorateWithCorrelations({
      showCorrelationEditorLinks: false,
      queries: [],
      correlations: [],
      defaultTargetDatasource: undefined,
    })(panelData);

    const flattenedLinks = postDecoratedPanel.series
      .flatMap((frame) => frame.fields)
      .flatMap((field) => field.config.links);
    expect(flattenedLinks).toEqual([]);
  });

  it('returns one field link per field if there are no correlations, but there are editor links', () => {
    const { table } = getTestContext();
    const series = [table];
    const timeRange = getDefaultTimeRange();
    const panelData: PanelData = {
      series,
      state: LoadingState.Done,
      timeRange,
    };

    const postDecoratedPanel = decorateWithCorrelations({
      showCorrelationEditorLinks: true,
      queries: [],
      correlations: [],
      defaultTargetDatasource: datasource,
    })(panelData);

    const flattenedLinks = postDecoratedPanel.series
      .flatMap((frame) => frame.fields)
      .flatMap((field) => field.config.links);

    expect(flattenedLinks.length).toEqual(table.fields.length);
    expect(flattenedLinks[0]).not.toBeUndefined();
  });

  it('returns one field link per field if there are correlations and editor links', () => {
    const { table } = getTestContext();
    const series = [table];
    const timeRange = getDefaultTimeRange();
    const panelData: PanelData = {
      series,
      state: LoadingState.Done,
      timeRange,
    };

    const correlations = [{ source: datasourceInstance, target: datasourceInstance }] as CorrelationData[];
    const postDecoratedPanel = decorateWithCorrelations({
      showCorrelationEditorLinks: true,
      queries: [],
      correlations: correlations,
      defaultTargetDatasource: datasource,
    })(panelData);

    const flattenedLinks = postDecoratedPanel.series
      .flatMap((frame) => frame.fields)
      .flatMap((field) => field.config.links);

    expect(flattenedLinks.length).toEqual(table.fields.length);
    expect(flattenedLinks[0]).not.toBeUndefined();
  });

  it('returns one field link per correlation if there are correlations and we are not showing editor links', () => {
    const { table } = getTestContext();
    const series = [table];
    const timeRange = getDefaultTimeRange();
    const panelData: PanelData = {
      series,
      state: LoadingState.Done,
      timeRange,
    };

    const correlations = [
      {
        uid: '0',
        source: datasourceInstance,
        target: datasourceInstance,
        provisioned: true,
        type: 'query',
        config: { field: panelData.series[0].fields[0].name },
      },
    ] as CorrelationData[];

    const postDecoratedPanel = decorateWithCorrelations({
      showCorrelationEditorLinks: false,
      queries: [{ refId: 'A', datasource: datasource.getRef() }],
      correlations: correlations,
      defaultTargetDatasource: undefined,
    })(panelData);

    const flattenedLinks = postDecoratedPanel.series
      .flatMap((frame) => frame.fields)
      .flatMap((field) => field.config.links);

    expect(flattenedLinks.length).toEqual(correlations.length);
  });
});
