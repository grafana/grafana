import {
  LogsModel,
  GraphSeriesXY,
  DataFrame,
  FieldType,
  TimeZone,
  getDisplayProcessor,
  PreferredVisualisationType,
  standardTransformers,
} from '@grafana/data';
import { ExploreItemState } from 'app/types/explore';
import { sortLogsResult, refreshIntervalToSortOrder } from 'app/core/utils/explore';
import { dataFrameToLogsModel } from 'app/core/logs_model';
import { getGraphSeriesModel } from 'app/plugins/panel/graph2/getGraphSeriesModel';
import { config } from 'app/core/config';

export class ResultProcessor {
  graphFrames: DataFrame[] = [];
  tableFrames: DataFrame[] = [];
  logsFrames: DataFrame[] = [];
  traceFrames: DataFrame[] = [];

  constructor(
    private state: ExploreItemState,
    private dataFrames: DataFrame[],
    private intervalMs: number,
    private timeZone: TimeZone
  ) {
    this.classifyFrames();
  }

  private classifyFrames() {
    for (const frame of this.dataFrames) {
      if (shouldShowInVisualisationTypeStrict(frame, 'logs')) {
        this.logsFrames.push(frame);
      } else if (shouldShowInVisualisationTypeStrict(frame, 'graph')) {
        this.graphFrames.push(frame);
      } else if (shouldShowInVisualisationTypeStrict(frame, 'trace')) {
        this.traceFrames.push(frame);
      } else if (shouldShowInVisualisationTypeStrict(frame, 'table')) {
        this.tableFrames.push(frame);
      } else if (isTimeSeries(frame, this.state.datasourceInstance?.meta.id)) {
        if (shouldShowInVisualisationType(frame, 'graph')) {
          this.graphFrames.push(frame);
        }
        if (shouldShowInVisualisationType(frame, 'table')) {
          this.tableFrames.push(frame);
        }
      } else {
        // We fallback to table if we do not have any better meta info about the dataframe.
        this.tableFrames.push(frame);
      }
    }
  }

  getGraphResult(): GraphSeriesXY[] | null {
    if (this.graphFrames.length === 0) {
      return null;
    }

    return getGraphSeriesModel(
      this.graphFrames,
      this.timeZone,
      {},
      { showBars: false, showLines: true, showPoints: false },
      { asTable: false, isVisible: true, placement: 'under' }
    );
  }

  getTableResult(): DataFrame | null {
    if (this.tableFrames.length === 0) {
      return null;
    }

    this.tableFrames.sort((frameA: DataFrame, frameB: DataFrame) => {
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

    const hasOnlyTimeseries = this.tableFrames.every(df => isTimeSeries(df));

    // If we have only timeseries we do join on default time column which makes more sense. If we are showing
    // non timeseries or some mix of data we are not trying to join on anything and just try to merge them in
    // single table, which may not make sense in most cases, but it's up to the user to query something sensible.
    const transformer = hasOnlyTimeseries
      ? standardTransformers.seriesToColumnsTransformer.transformer({})
      : standardTransformers.mergeTransformer.transformer({});

    const data = transformer(this.tableFrames)[0];

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
    if (this.logsFrames.length === 0) {
      return null;
    }

    const newResults = dataFrameToLogsModel(this.logsFrames, this.intervalMs, this.timeZone, this.state.absoluteRange);
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

function shouldShowInVisualisationType(frame: DataFrame, visualisation: PreferredVisualisationType) {
  if (frame.meta?.preferredVisualisationType && frame.meta?.preferredVisualisationType !== visualisation) {
    return false;
  }

  return true;
}

function shouldShowInVisualisationTypeStrict(frame: DataFrame, visualisation: PreferredVisualisationType) {
  return frame.meta?.preferredVisualisationType === visualisation;
}

// TEMP: Temporary hack. Remove when logs/metrics unification is done
function isTimeSeriesCloudWatch(frame: DataFrame): boolean {
  return (
    frame.fields.some(field => field.type === FieldType.time) &&
    frame.fields.some(field => field.type === FieldType.number)
  );
}
