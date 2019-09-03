import { LogsModel, GraphSeriesXY, DataFrame, FieldType } from '@grafana/data';

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

    // For now ignore time series
    // We can change this later, just need to figure out how to
    // Ignore time series only for prometheus
    const onlyTables = this.dataFrames.filter(frame => {
      if (frame.fields.length === 2) {
        if (frame.fields[1].type === FieldType.time) {
          return false;
        }
      }
      return true;
    });

    const tables = onlyTables.map(frame => {
      const { fields } = frame;
      const fieldCount = fields.length;
      const rowCount = fields[0].values.length;

      const columns = fields.map(field => ({
        text: field.name,
        type: field.type,
        filterable: field.config.filterable,
      }));

      const rows: any[][] = [];
      for (let i = 0; i < rowCount; i++) {
        const row: any[] = [];
        for (let j = 0; j < fieldCount; j++) {
          row.push(frame.fields[j].values.get(i));
        }
        rows.push(row);
      }

      return new TableModel({
        columns,
        rows,
        meta: frame.meta,
      });
    });

    return mergeTablesIntoModel(new TableModel(), ...tables);
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
}
