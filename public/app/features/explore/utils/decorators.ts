import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AbsoluteTimeRange,
  DataFrame,
  FieldType,
  getDisplayProcessor,
  PanelData,
  sortLogsResult,
  standardTransformers,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { groupBy } from 'lodash';

import { ExplorePanelData } from '../../../types';
import { getGraphSeriesModel } from '../../../plugins/panel/graph2/getGraphSeriesModel';
import { dataFrameToLogsModel } from '../../../core/logs_model';
import { refreshIntervalToSortOrder } from '../../../core/utils/explore';

/**
 * When processing response first we try to determine what kind of dataframes we got as one query can return multiple
 * dataFrames with different type of data. This is later used for type specific processing. As we use this in
 * Observable pipeline, it decorates the existing panelData to pass the results to later processing stages.
 */
export const decorateWithGraphLogsTraceAndTable = (data: PanelData): ExplorePanelData => {
  if (data.error) {
    return {
      ...data,
      graphFrames: [],
      tableFrames: [],
      logsFrames: [],
      traceFrames: [],
      graphResult: null,
      tableResult: null,
      logsResult: null,
    };
  }

  const graphFrames: DataFrame[] = [];
  const tableFrames: DataFrame[] = [];
  const logsFrames: DataFrame[] = [];
  const traceFrames: DataFrame[] = [];

  for (const frame of data.series) {
    switch (frame.meta?.preferredVisualisationType) {
      case 'logs':
        logsFrames.push(frame);
        break;
      case 'graph':
        graphFrames.push(frame);
        break;
      case 'trace':
        traceFrames.push(frame);
        break;
      case 'table':
        tableFrames.push(frame);
        break;
      default:
        if (isTimeSeries(frame)) {
          graphFrames.push(frame);
          tableFrames.push(frame);
        } else {
          // We fallback to table if we do not have any better meta info about the dataframe.
          tableFrames.push(frame);
        }
    }
  }

  return {
    ...data,
    graphFrames,
    tableFrames,
    logsFrames,
    traceFrames,
    graphResult: null,
    tableResult: null,
    logsResult: null,
  };
};

export const decorateWithGraphResult = (data: ExplorePanelData): ExplorePanelData => {
  if (data.error) {
    return { ...data, graphResult: null };
  }

  const graphResult =
    data.graphFrames.length === 0
      ? null
      : getGraphSeriesModel(
          data.graphFrames,
          data.request?.timezone ?? 'browser',
          {},
          { showBars: false, showLines: true, showPoints: false },
          { asTable: false, isVisible: true, placement: 'under' }
        );

  return { ...data, graphResult };
};

/**
 * This processing returns Observable because it uses Transformer internally which result type is also Observable.
 * In this case the transformer should return single result but it is possible that in the future it could return
 * multiple results and so this should be used with mergeMap or similar to unbox the internal observable.
 */
export const decorateWithTableResult = (data: ExplorePanelData): Observable<ExplorePanelData> => {
  if (data.error) {
    return of({ ...data, tableResult: null });
  }

  if (data.tableFrames.length === 0) {
    return of({ ...data, tableResult: null });
  }

  data.tableFrames.sort((frameA: DataFrame, frameB: DataFrame) => {
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

  const hasOnlyTimeseries = data.tableFrames.every(df => isTimeSeries(df));

  // If we have only timeseries we do join on default time column which makes more sense. If we are showing
  // non timeseries or some mix of data we are not trying to join on anything and just try to merge them in
  // single table, which may not make sense in most cases, but it's up to the user to query something sensible.
  const transformer = hasOnlyTimeseries
    ? of(data.tableFrames).pipe(standardTransformers.seriesToColumnsTransformer.operator({}))
    : of(data.tableFrames).pipe(standardTransformers.mergeTransformer.operator({}));

  return transformer.pipe(
    map(frames => {
      const frame = frames[0];

      // set display processor
      for (const field of frame.fields) {
        field.display =
          field.display ??
          getDisplayProcessor({
            field,
            theme: config.theme,
            timeZone: data.request?.timezone ?? 'browser',
          });
      }

      return { ...data, tableResult: frame };
    })
  );
};

export const decorateWithLogsResult = (
  options: { absoluteRange?: AbsoluteTimeRange; refreshInterval?: string } = {}
) => (data: ExplorePanelData): ExplorePanelData => {
  if (data.error) {
    return { ...data, logsResult: null };
  }

  if (data.logsFrames.length === 0) {
    return { ...data, logsResult: null };
  }

  const timeZone = data.request?.timezone ?? 'browser';
  const intervalMs = data.request?.intervalMs;
  const newResults = dataFrameToLogsModel(data.logsFrames, intervalMs, timeZone, options.absoluteRange);
  const sortOrder = refreshIntervalToSortOrder(options.refreshInterval);
  const sortedNewResults = sortLogsResult(newResults, sortOrder);
  const rows = sortedNewResults.rows;
  const series = sortedNewResults.series;
  const logsResult = { ...sortedNewResults, rows, series };

  return { ...data, logsResult };
};

/**
 * Check if frame contains time series, which for our purpose means 1 time column and 1 or more numeric columns.
 */
function isTimeSeries(frame: DataFrame): boolean {
  const grouped = groupBy(frame.fields, field => field.type);
  return Boolean(
    Object.keys(grouped).length === 2 && grouped[FieldType.time]?.length === 1 && grouped[FieldType.number]
  );
}
