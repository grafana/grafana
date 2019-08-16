import { DataQueryResponse, DataQueryResponseData } from '@grafana/ui';

import {
  TableData,
  isTableData,
  LogsModel,
  toDataFrame,
  guessFieldTypes,
  TimeSeries,
  GraphSeriesXY,
  LoadingState,
} from '@grafana/data';

import { ExploreItemState, ExploreMode } from 'app/types/explore';
import { getProcessedDataFrames } from 'app/features/dashboard/state/PanelQueryState';
import TableModel, { mergeTablesIntoModel } from 'app/core/table_model';
import { sortLogsResult } from 'app/core/utils/explore';
import { dataFrameToLogsModel } from 'app/core/logs_model';
import { getGraphSeriesModel } from 'app/plugins/panel/graph2/getGraphSeriesModel';

export class ResultProcessor {
  private rawData: DataQueryResponseData[] = [];
  private metrics: TimeSeries[] = [];
  private tables: TableData[] = [];

  constructor(
    private state: ExploreItemState,
    private replacePreviousResults: boolean,
    result?: DataQueryResponse | DataQueryResponseData[]
  ) {
    if (result && result.hasOwnProperty('data')) {
      this.rawData = (result as DataQueryResponse).data;
    } else {
      this.rawData = (result as DataQueryResponseData[]) || [];
    }

    if (this.state.mode !== ExploreMode.Metrics) {
      return;
    }

    for (let index = 0; index < this.rawData.length; index++) {
      const res: any = this.rawData[index];
      const isTable = isTableData(res);
      if (isTable) {
        this.tables.push(res);
      } else {
        this.metrics.push(res);
      }
    }
  }

  getRawData = (): any[] => {
    return this.rawData;
  };

  getGraphResult = (): GraphSeriesXY[] => {
    if (this.state.mode !== ExploreMode.Metrics) {
      return [];
    }

    const newResults = this.createGraphSeries(this.metrics);
    return this.mergeGraphResults(newResults, this.state.graphResult);
  };

  getTableResult = (): TableModel => {
    if (this.state.mode !== ExploreMode.Metrics) {
      return new TableModel();
    }

    const prevTableResults: any[] | TableModel = this.state.tableResult || [];
    const tablesToMerge = this.replacePreviousResults ? this.tables : [].concat(prevTableResults, this.tables);

    return mergeTablesIntoModel(new TableModel(), ...tablesToMerge);
  };

  getLogsResult = (): LogsModel => {
    if (this.state.mode !== ExploreMode.Logs) {
      return null;
    }
    const graphInterval = this.state.queryIntervals.intervalMs;
    const dataFrame = this.rawData.map(result => guessFieldTypes(toDataFrame(result)));
    const newResults = this.rawData ? dataFrameToLogsModel(dataFrame, graphInterval) : null;
    const sortedNewResults = sortLogsResult(newResults, this.state.refreshInterval);

    if (this.replacePreviousResults) {
      return sortedNewResults;
    }

    const prevLogsResult: LogsModel = this.state.logsResult || { hasUniqueLabels: false, rows: [] };
    const sortedLogResult = sortLogsResult(prevLogsResult, this.state.refreshInterval);
    const rowsInState = sortedLogResult.rows;
    const seriesInState = sortedLogResult.series || [];

    const processedRows = [];
    for (const row of rowsInState) {
      processedRows.push({ ...row, fresh: false });
    }
    for (const row of sortedNewResults.rows) {
      processedRows.push({ ...row, fresh: true });
    }

    const processedSeries = this.mergeGraphResults(sortedNewResults.series, seriesInState);

    const slice = -1000;
    const rows = processedRows.slice(slice);
    const series = processedSeries.slice(slice);

    return { ...sortedNewResults, rows, series };
  };

  private createGraphSeries = (rawData: any[]) => {
    const dataFrames = getProcessedDataFrames(rawData);
    const graphSeries = getGraphSeriesModel(
      { series: dataFrames, state: LoadingState.Done },
      {},
      { showBars: false, showLines: true, showPoints: false },
      {
        asTable: false,
        isVisible: true,
        placement: 'under',
      }
    );

    return graphSeries;
  };

  private isSameGraphSeries = (a: GraphSeriesXY, b: GraphSeriesXY) => {
    if (a.hasOwnProperty('label') && b.hasOwnProperty('label')) {
      const aValue = a.label;
      const bValue = b.label;
      if (aValue !== undefined && bValue !== undefined && aValue === bValue) {
        return true;
      }
    }

    return false;
  };

  private mergeGraphResults = (newResults: GraphSeriesXY[], prevResults: GraphSeriesXY[]): GraphSeriesXY[] => {
    if (!prevResults || prevResults.length === 0 || this.replacePreviousResults) {
      return newResults; // Hack before we use GraphSeriesXY instead
    }

    const results: GraphSeriesXY[] = prevResults.slice() as GraphSeriesXY[];

    // update existing results
    for (let index = 0; index < results.length; index++) {
      const prevResult = results[index];
      for (const newResult of newResults) {
        const isSame = this.isSameGraphSeries(prevResult, newResult);

        if (isSame) {
          prevResult.data = prevResult.data.concat(newResult.data);
          break;
        }
      }
    }

    // add new results
    for (const newResult of newResults) {
      let isNew = true;
      for (const prevResult of results) {
        const isSame = this.isSameGraphSeries(prevResult, newResult);
        if (isSame) {
          isNew = false;
          break;
        }
      }

      if (isNew) {
        results.push(newResult);
      }
    }
    return results;
  };
}
