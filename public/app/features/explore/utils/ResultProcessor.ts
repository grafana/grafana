import {
  LogsModel,
  GraphSeriesXY,
  DataFrame,
  FieldType,
  TimeZone,
  toDataFrame,
  getDisplayProcessor,
  ExploreMode,
  PreferredVisualisationType,
} from '@grafana/data';
import { ExploreItemState } from 'app/types/explore';
import TableModel, { mergeTablesIntoModel, MutableColumn } from 'app/core/table_model';
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
    if (this.state.mode !== ExploreMode.Metrics && !this.state.datasourceInstance.meta.unified) {
      return null;
    }

    const timeSeriesChecker = this.state.datasourceInstance?.meta.unified ? isTimeSeries : isTimeSeriesLegacy;
    const onlyTimeSeries = this.dataFrames.filter(frame =>
      timeSeriesChecker(frame, this.state.datasourceInstance?.meta.id)
    );
    const timeSeriesToShowInGraph = onlyTimeSeries.filter(frame => shouldShowInVisualisationType(frame, 'graph'));

    if (timeSeriesToShowInGraph.length === 0) {
      return null;
    }

    return getGraphSeriesModel(
      timeSeriesToShowInGraph,
      this.timeZone,
      {},
      { showBars: false, showLines: true, showPoints: false, yaxis: 2 },
      { asTable: false, isVisible: true, placement: 'under' }
    );
  }

  getTableResult(): DataFrame | null {
    if (this.state.mode !== ExploreMode.Metrics && !this.state.datasourceInstance.meta.unified) {
      return null;
    }

    const onlyTables = this.dataFrames
      .filter((frame: DataFrame) => shouldShowInVisualisationType(frame, 'table'))
      .sort((frameA: DataFrame, frameB: DataFrame) => {
        const frameARefId = frameA.refId!;
        const frameBRefId = frameB.refId!;

        if (frameARefId > frameBRefId) {
          return 1;
        }
        if (frameARefId < frameBRefId) {
          return -1;
        }
        return 0;
      });

    if (onlyTables.length === 0) {
      return null;
    }

    const tables = onlyTables.map(frame => {
      const { fields } = frame;
      const fieldCount = fields.length;
      const rowCount = frame.length;

      const columns: MutableColumn[] = fields.map(field => ({
        text: field.name,
        type: field.type,
        filterable: field.config.filterable,
        custom: field.config.custom,
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

    // Make time column first column
    const timeColIndex = data.fields.findIndex(field => field.type === FieldType.time);
    data.fields.unshift(data.fields[timeColIndex]);
    data.fields.splice(timeColIndex + 1, 1);

    return data;
  }

  getLogsResult(): LogsModel | null {
    const isUnifiedDatasource = this.state.datasourceInstance?.meta.unified;
    if (this.state.mode !== ExploreMode.Logs && !isUnifiedDatasource) {
      return null;
    }

    const newResults = dataFrameToLogsModel(
      this.dataFrames,
      this.intervalMs,
      this.timeZone,
      this.state.absoluteRange,
      isUnifiedDatasource
    );
    const sortOrder = refreshIntervalToSortOrder(this.state.refreshInterval);
    const sortedNewResults = sortLogsResult(newResults, sortOrder);
    const rows = sortedNewResults.rows;
    const series = sortedNewResults.series;
    return { ...sortedNewResults, rows, series };
  }
}

function isTimeSeries(frame: DataFrame, datasource?: string): boolean {
  if (frame.meta?.responseType) {
    return frame.meta.responseType === 'Metrics';
  }

  if (frame.meta?.instant) {
    return false;
  }

  return (
    frame.fields.some(field => field.type === FieldType.time) &&
    frame.fields.some(field => field.type === FieldType.number)
  );
}

export function isTimeSeriesLegacy(frame: DataFrame, datasource?: string): boolean {
  // TEMP: Temporary hack. Remove when logs/metrics unification is done
  if (datasource && datasource === 'cloudwatch') {
    return isTimeSeriesCloudWatch(frame);
  }

  return frame.fields.length === 2 && frame.fields[0].type === FieldType.time;
}

function shouldShowInVisualisationType(frame: DataFrame, visualisation: PreferredVisualisationType) {
  if (frame.meta?.preferredVisualisationType && frame.meta?.preferredVisualisationType !== visualisation) {
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
