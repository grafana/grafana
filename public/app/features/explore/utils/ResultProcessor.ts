import { TableData, LogsModel, TimeSeries, GraphSeriesXY, DataFrame } from '@grafana/data';

import { ExploreItemState, ExploreMode } from 'app/types/explore';
import TableModel, { mergeTablesIntoModel } from 'app/core/table_model';
import { sortLogsResult, refreshIntervalToSortOrder } from 'app/core/utils/explore';
import { dataFrameToLogsModel } from 'app/core/logs_model';
import { getGraphSeriesModel } from 'app/plugins/panel/graph2/getGraphSeriesModel';

export class ResultProcessor {
  constructor(
    private state: ExploreItemState,
    private replacePreviousResults: boolean,
    private dataFrames: DataFrame[]
  ) {}

  getGraphResult(): GraphSeriesXY[] {
    if (this.state.mode !== ExploreMode.Metrics) {
      return [];
    }

    const onlyTimeSeries = this.dataFrames.filter(series => series.fields.length === 2);

    return getGraphSeriesModel(
      onlyTimeSeries,
      {},
      { showBars: false, showLines: true, showPoints: false },
      { asTable: false, isVisible: true, placement: 'under' }
    );
  }

  getTableResult(): TableModel {
    if (this.state.mode !== ExploreMode.Metrics) {
      return new TableModel();
    }

    return new TableModel();
    // const tables = this.panelData.series.map(frame => {
    // });
    // const prevTableResults: any[] | TableModel = this.state.tableResult || [];
    // const tablesToMerge = this.replacePreviousResults ? this.tables : [].concat(prevTableResults, this.tables);
    //
    // return mergeTablesIntoModel(new TableModel(), ...tablesToMerge);
  }

  getLogsResult(): LogsModel {
    if (this.state.mode !== ExploreMode.Logs) {
      return null;
    }

    const graphInterval = this.state.queryIntervals.intervalMs;

    const newResults = dataFrameToLogsModel(this.dataFrames, graphInterval);
    const sortOrder = refreshIntervalToSortOrder(this.state.refreshInterval);
    const sortedNewResults = sortLogsResult(newResults, sortOrder);

    if (this.replacePreviousResults) {
      const slice = 1000;
      const rows = sortedNewResults.rows.slice(0, slice);
      const series = sortedNewResults.series;

      return { ...sortedNewResults, rows, series };
    }

    const prevLogsResult: LogsModel = this.state.logsResult || { hasUniqueLabels: false, rows: [] };
    const sortedLogResult = sortLogsResult(prevLogsResult, sortOrder);
    const rowsInState = sortedLogResult.rows;

    const processedRows = [];
    for (const row of rowsInState) {
      processedRows.push({ ...row, fresh: false });
    }
    for (const row of sortedNewResults.rows) {
      processedRows.push({ ...row, fresh: true });
    }

    const slice = -1000;
    const rows = processedRows.slice(slice);
    const series = sortedNewResults.series.slice(slice);

    return { ...sortedNewResults, rows, series };
  }

  // private isSameGraphSeries = (a: GraphSeriesXY, b: GraphSeriesXY) => {
  //   if (a.hasOwnProperty('label') && b.hasOwnProperty('label')) {
  //     const aValue = a.label;
  //     const bValue = b.label;
  //     if (aValue !== undefined && bValue !== undefined && aValue === bValue) {
  //       return true;
  //     }
  //   }
  //
  //   return false;
  // };
  //
  // private mergeGraphResults = (newResults: GraphSeriesXY[], prevResults: GraphSeriesXY[]): GraphSeriesXY[] => {
  //   if (!prevResults || prevResults.length === 0 || this.replacePreviousResults) {
  //     return newResults; // Hack before we use GraphSeriesXY instead
  //   }
  //
  //   const results: GraphSeriesXY[] = prevResults.slice() as GraphSeriesXY[];
  //
  //   // update existing results
  //   for (let index = 0; index < results.length; index++) {
  //     const prevResult = results[index];
  //     for (const newResult of newResults) {
  //       const isSame = this.isSameGraphSeries(prevResult, newResult);
  //
  //       if (isSame) {
  //         prevResult.data = prevResult.data.concat(newResult.data);
  //         break;
  //       }
  //     }
  //   }
  //
  //   // add new results
  //   for (const newResult of newResults) {
  //     let isNew = true;
  //     for (const prevResult of results) {
  //       const isSame = this.isSameGraphSeries(prevResult, newResult);
  //       if (isSame) {
  //         isNew = false;
  //         break;
  //       }
  //     }
  //
  //     if (isNew) {
  //       results.push(newResult);
  //     }
  //   }
  //   return results;
  // };
}
