import {
  DataQueryResponse,
  TableData,
  isTableData,
  LogsModel,
  toSeriesData,
  guessFieldTypes,
  DataQueryResponseData,
  TimeSeries,
} from '@grafana/ui';

import { ExploreItemState, ExploreMode } from 'app/types/explore';
import { getProcessedSeriesData } from 'app/features/dashboard/state/PanelQueryState';
import TableModel, { mergeTablesIntoModel } from 'app/core/table_model';
import { sortLogsResult } from 'app/core/utils/explore';
import { seriesDataToLogsModel } from 'app/core/logs_model';
import { default as TimeSeries2 } from 'app/core/time_series2';
import { DataProcessor } from 'app/plugins/panel/graph/data_processor';

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

  getGraphResult = (): TimeSeries[] => {
    if (this.state.mode !== ExploreMode.Metrics) {
      return [];
    }

    const newResults = this.makeTimeSeriesList(this.metrics);
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
    const seriesData = this.rawData.map(result => guessFieldTypes(toSeriesData(result)));
    const newResults = this.rawData ? seriesDataToLogsModel(seriesData, graphInterval) : null;

    if (this.replacePreviousResults) {
      return newResults;
    }

    const prevLogsResult: LogsModel = this.state.logsResult || { hasUniqueLabels: false, rows: [] };
    const sortedLogResult = sortLogsResult(prevLogsResult, this.state.refreshInterval);
    const rowsInState = sortedLogResult.rows;
    const seriesInState = sortedLogResult.series || [];

    const processedRows = [];
    for (const row of rowsInState) {
      processedRows.push({ ...row, fresh: false });
    }
    for (const row of newResults.rows) {
      processedRows.push({ ...row, fresh: true });
    }

    const processedSeries = this.mergeGraphResults(newResults.series, seriesInState);

    const slice = -1000;
    const rows = processedRows.slice(slice);
    const series = processedSeries.slice(slice);

    return { ...newResults, rows, series };
  };

  private makeTimeSeriesList = (rawData: any[]) => {
    const dataList = getProcessedSeriesData(rawData);
    const dataProcessor = new DataProcessor({ xaxis: {}, aliasColors: [] }); // Hack before we use GraphSeriesXY instead
    const timeSeries = dataProcessor.getSeriesList({ dataList });

    return (timeSeries as any) as TimeSeries[]; // Hack before we use GraphSeriesXY instead
  };

  private isSameTimeSeries = (a: TimeSeries | TimeSeries2, b: TimeSeries | TimeSeries2) => {
    if (a.hasOwnProperty('id') && b.hasOwnProperty('id')) {
      const aValue = (a as TimeSeries2).id;
      const bValue = (b as TimeSeries2).id;
      if (aValue !== undefined && bValue !== undefined && aValue === bValue) {
        return true;
      }
    }

    if (a.hasOwnProperty('alias') && b.hasOwnProperty('alias')) {
      const aValue = (a as TimeSeries2).alias;
      const bValue = (b as TimeSeries2).alias;
      if (aValue !== undefined && bValue !== undefined && aValue === bValue) {
        return true;
      }
    }

    return false;
  };

  private mergeGraphResults = (
    newResults: TimeSeries[] | TimeSeries2[],
    prevResults: TimeSeries[] | TimeSeries2[]
  ): TimeSeries[] => {
    if (!prevResults || prevResults.length === 0 || this.replacePreviousResults) {
      return (newResults as any) as TimeSeries[]; // Hack before we use GraphSeriesXY instead
    }

    const results: TimeSeries[] = prevResults.slice() as TimeSeries[];

    // update existing results
    for (let index = 0; index < results.length; index++) {
      const prevResult = results[index];
      for (const newResult of newResults) {
        const isSame = this.isSameTimeSeries(prevResult, newResult);

        if (isSame) {
          prevResult.datapoints = prevResult.datapoints.concat(newResult.datapoints);
          break;
        }
      }
    }

    // add new results
    for (const newResult of newResults) {
      let isNew = true;
      for (const prevResult of results) {
        const isSame = this.isSameTimeSeries(prevResult, newResult);
        if (isSame) {
          isNew = false;
          break;
        }
      }

      if (isNew) {
        const timeSeries2Result = new TimeSeries2({ ...newResult });

        const result = (timeSeries2Result as any) as TimeSeries; // Hack before we use GraphSeriesXY instead
        results.push(result);
      }
    }
    return results;
  };
}
