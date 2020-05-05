import {
  LogsModel,
  GraphSeriesXY,
  DataFrame,
  FieldType,
  TimeZone,
  toDataFrame,
  getDisplayProcessor,
  ExploreMode,
} from '@grafana/data';
import { ExploreItemState } from 'app/types/explore';
import TableModel, { mergeTablesIntoModel } from 'app/core/table_model';
import { sortLogsResult, refreshIntervalToSortOrder } from 'app/core/utils/explore';
import { dataFrameToLogsModel } from 'app/core/logs_model';
import { getGraphSeriesModel } from 'app/plugins/panel/graph2/getGraphSeriesModel';
import { config } from 'app/core/config';

export class ResultProcessor {
  constructor(
    private state: ExploreItemState,
    private dataFrames: DataFrame[],
    private intervalMs: number,
    private timeZone: TimeZone
  ) {}

  getGraphResult(): GraphSeriesXY[] | null {
    if (this.state.mode !== ExploreMode.Metrics) {
      return null;
    }

    const onlyTimeSeries = this.dataFrames.filter(frame => isTimeSeries(frame, this.state.datasourceInstance?.meta.id));

    if (onlyTimeSeries.length === 0) {
      return null;
    }

    return getGraphSeriesModel(
      onlyTimeSeries,
      this.timeZone,
      {},
      { showBars: false, showLines: true, showPoints: false },
      { asTable: false, isVisible: true, placement: 'under' }
    );
  }

  getTableResult(): DataFrame | null {
    if (this.state.mode !== ExploreMode.Metrics) {
      return null;
    }

    const onlyTables = this.dataFrames.filter(frame => shouldShowInTable(frame));

    if (onlyTables.length === 0) {
      return null;
    }

    const tables = onlyTables.map(frame => {
      const { fields } = frame;
      const fieldCount = fields.length;
      const rowCount = frame.length;

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

    const mergedTable = mergeTablesIntoModel(new TableModel(), ...tables);
    const data = toDataFrame(mergedTable);

    // set display processor
    for (const field of data.fields) {
      field.display = getDisplayProcessor({
        field,
        theme: config.theme,
        timeZone: this.timeZone,
      });
    }

    return data;
  }

  getLogsResult(): LogsModel | null {
    if (this.state.mode !== ExploreMode.Logs) {
      return null;
    }

    const isLokiDatasource: boolean = this.state.datasourceInstance?.meta?.id === 'loki';
    const newResults = dataFrameToLogsModel(this.dataFrames, this.intervalMs, this.timeZone, isLokiDatasource);
    const sortOrder = refreshIntervalToSortOrder(this.state.refreshInterval);
    const sortedNewResults = sortLogsResult(newResults, sortOrder);
    const rows = sortedNewResults.rows;
    const series = sortedNewResults.series;
    return { ...sortedNewResults, rows, series };
  }
}

function isTimeSeries(frame: DataFrame, datasource?: string): boolean {
  // TEMP: Temporary hack. Remove when logs/metrics unification is done
  if (datasource && datasource === 'cloudwatch') {
    return isTimeSeriesCloudWatch(frame);
  }

  if (frame.fields.length === 2) {
    if (frame.fields[0].type === FieldType.time) {
      return true;
    }
  }

  return false;
}

function shouldShowInTable(frame: DataFrame) {
  if (frame.meta?.preferredVisualisationType && frame.meta?.preferredVisualisationType !== 'table') {
    return false;
  }

  return true;
}

// TEMP: Temporary hack. Remove when logs/metrics unification is done
function isTimeSeriesCloudWatch(frame: DataFrame): boolean {
  return (
    frame.fields.some(field => field.type === FieldType.time) &&
    frame.fields.some(field => field.type === FieldType.number)
  );
}
