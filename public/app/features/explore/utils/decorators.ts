import { groupBy } from 'lodash';
import { Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import {
  AbsoluteTimeRange,
  DataFrame,
  FieldType,
  getDisplayProcessor,
  PanelData,
  sortLogsResult,
  standardTransformers,
  DataQuery,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { dataFrameToLogsModel } from '../../../core/logsModel';
import { refreshIntervalToSortOrder } from '../../../core/utils/explore';
import { isNodeGraphFrame } from '../../../plugins/panel/nodeGraph/utils';
import { ExplorePanelData } from '../../../types';
import { preProcessPanelData } from '../../query/state/runRequest';

/**
 import { isNodeGraphFrame } from 'app/plugins/panel/nodeGraph/utils';
 * When processing response first we try to determine what kind of dataframes we got as one query can return multiple
 * dataFrames with different type of data. This is later used for type specific processing. As we use this in
 * Observable pipeline, it decorates the existing panelData to pass the results to later processing stages.
 */
export const groupFramesByVisType = (data: PanelData): ExplorePanelData => {
  const framesMap: { [key: string]: DataFrame[] } = {};

  for (const frame of data.series) {
    const visType = frame.meta?.preferredVisualisationType;
    if (visType) {
      framesMap[visType] = framesMap[visType] || [];
      framesMap[visType].push(frame);
    } else {
      if (isTimeSeries(frame)) {
        framesMap['graph'] = framesMap['graph'] || [];
        framesMap['graph'].push(frame);
        framesMap['table'] = framesMap['table'] || [];
        framesMap['table'].push(frame);
      } else if (isNodeGraphFrame(frame)) {
        framesMap['nodeGraph'] = framesMap['nodeGraph'] || [];
        framesMap['nodeGraph'].push(frame);
      } else {
        // We fallback to table if we do not have any better meta info about the dataframe.
        framesMap['table'] = framesMap['table'] || [];
        framesMap['table'].push(frame);
      }
    }
  }

  return {
    ...data,
    framesMap,
  };
};

/**
 * This processing returns Observable because it uses Transformer internally which result type is also Observable.
 * In this case the transformer should return single result but it is possible that in the future it could return
 * multiple results and so this should be used with mergeMap or similar to unbox the internal observable.
 */
export const mergeTableFrames = (data: ExplorePanelData): Observable<ExplorePanelData> => {
  let tableFrames = data.framesMap['table'];
  if (!tableFrames?.length) {
    return of({ ...data, tableResult: null });
  }

  tableFrames.sort((frameA: DataFrame, frameB: DataFrame) => {
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

  const hasOnlyTimeseries = tableFrames.every((df) => isTimeSeries(df));

  // If we have only timeseries we do join on default time column which makes more sense. If we are showing
  // non timeseries or some mix of data we are not trying to join on anything and just try to merge them in
  // single table, which may not make sense in most cases, but it's up to the user to query something sensible.
  const transformer = hasOnlyTimeseries
    ? of(tableFrames).pipe(standardTransformers.seriesToColumnsTransformer.operator({}))
    : of(tableFrames).pipe(standardTransformers.mergeTransformer.operator({}));

  return transformer.pipe(
    map((frames) => {
      const frame = frames[0];

      // set display processor
      for (const field of frame.fields) {
        field.display =
          field.display ??
          getDisplayProcessor({
            field,
            theme: config.theme2,
            timeZone: data.request?.timezone ?? 'browser',
          });
      }

      return { ...data, tableResult: frame };
    })
  );
};

// For logs specifically we process the dataFrames early and transform to a logs model data.
export const processLogs =
  (
    options: {
      absoluteRange?: AbsoluteTimeRange;
      refreshInterval?: string;
      queries?: DataQuery[];
      fullRangeLogsVolumeAvailable?: boolean;
    } = {}
  ) =>
  (data: ExplorePanelData): ExplorePanelData => {
    if (!data.framesMap['logs']?.length) {
      return { ...data, logsResult: undefined };
    }

    const intervalMs = data.request?.intervalMs;
    const newResults = dataFrameToLogsModel(data.framesMap['logs'], intervalMs, options.absoluteRange, options.queries);
    const sortOrder = refreshIntervalToSortOrder(options.refreshInterval);
    const sortedNewResults = sortLogsResult(newResults, sortOrder);
    const rows = sortedNewResults.rows;
    const series = options.fullRangeLogsVolumeAvailable ? undefined : sortedNewResults.series;
    const logsResult = { ...sortedNewResults, rows, series };

    return { ...data, logsResult };
  };

// decorateData applies all decorators
export function decorateData(
  data: PanelData,
  queryResponse: PanelData,
  absoluteRange: AbsoluteTimeRange,
  refreshInterval: string | undefined,
  queries: DataQuery[] | undefined,
  fullRangeLogsVolumeAvailable: boolean
): Observable<ExplorePanelData> {
  return of(data).pipe(
    map((data: PanelData) => preProcessPanelData(data, queryResponse)),
    map(groupFramesByVisType),
    map(processLogs({ absoluteRange, refreshInterval, queries, fullRangeLogsVolumeAvailable })),
    mergeMap(mergeTableFrames)
  );
}

/**
 * Check if frame contains time series, which for our purpose means 1 time column and 1 or more numeric columns.
 */
function isTimeSeries(frame: DataFrame): boolean {
  const grouped = groupBy(frame.fields, (field) => field.type);
  return Boolean(
    Object.keys(grouped).length === 2 && grouped[FieldType.time]?.length === 1 && grouped[FieldType.number]
  );
}
