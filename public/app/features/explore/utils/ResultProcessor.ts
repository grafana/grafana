import { LogsModel, GraphSeriesXY, DataFrame, FieldType } from '@grafana/data';

import { ExploreItemState, ExploreMode } from 'app/types/explore';
import TableModel, { mergeTablesIntoModel } from 'app/core/table_model';
import { sortLogsResult, refreshIntervalToSortOrder } from 'app/core/utils/explore';
import { dataFrameToLogsModel } from 'app/core/logs_model';
import { getGraphSeriesModel } from 'app/plugins/panel/graph2/getGraphSeriesModel';

export class ResultProcessor {
  constructor(private state: ExploreItemState, private dataFrames: DataFrame[]) {}

  getGraphResult(): GraphSeriesXY[] {
    if (this.state.mode !== ExploreMode.Metrics) {
      return [];
    }

    const onlyTimeSeries = this.dataFrames.filter(isTimeSeries);

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
    const onlyTables = this.dataFrames.filter(frame => !isTimeSeries(frame));

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

    const rows = sortedNewResults.rows;
    const series = sortedNewResults.series;
    return { ...sortedNewResults, rows, series };
  }
}

export function isTimeSeries(frame: DataFrame): boolean {
  if (frame.fields.length === 2) {
    if (frame.fields[1].type === FieldType.time) {
      return true;
    }
  }

  return false;
}
