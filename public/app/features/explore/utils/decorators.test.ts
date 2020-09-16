import { of } from 'rxjs';
import { DataFrame, DataSourceApi, FieldType, LoadingState, PanelData, TimeRange, toDataFrame } from '@grafana/data';

import { observableTester } from '../../../../test/helpers/observableTester';
import { decorateWithGraphLogsTraceAndTable } from './decorators';

describe('decorateWithGraphLogsTraceAndTable', () => {
  describe('when called without error', () => {
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

  describe('when called without frames', () => {
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

  describe('when called with an error', () => {
    it('then the result should be correct', done => {
      const datasourceInstance = ({ meta: { id: 'prometheus' } } as unknown) as DataSourceApi;
      const series: DataFrame[] = [];
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
            series: [],
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
