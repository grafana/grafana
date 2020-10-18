import {
  DataFrame,
  DataSourceApi,
  FieldType,
  getDisplayProcessor,
  PanelData,
  PreferredVisualisationType,
  sortLogsResult,
  standardTransformers,
  TIME_SERIES_VALUE_FIELD_NAME,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { AxisSide } from '@grafana/ui';
import { MonoTypeOperatorFunction, of, OperatorFunction } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { dataFrameToLogsModel } from '../../../core/logs_model';
import { refreshIntervalToSortOrder } from '../../../core/utils/explore';
import { ExploreItemState, ExplorePanelData } from '../../../types';

export const decorateWithGraphLogsTraceAndTable = (
  datasourceInstance?: DataSourceApi | null
): OperatorFunction<PanelData, ExplorePanelData> => inputStream =>
  inputStream.pipe(
    map(data => {
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
        if (shouldShowInVisualisationTypeStrict(frame, 'logs')) {
          logsFrames.push(frame);
        } else if (shouldShowInVisualisationTypeStrict(frame, 'graph')) {
          graphFrames.push(frame);
        } else if (shouldShowInVisualisationTypeStrict(frame, 'trace')) {
          traceFrames.push(frame);
        } else if (shouldShowInVisualisationTypeStrict(frame, 'table')) {
          tableFrames.push(frame);
        } else if (isTimeSeries(frame, datasourceInstance?.meta.id)) {
          if (shouldShowInVisualisationType(frame, 'graph')) {
            graphFrames.push(frame);
          }
          if (shouldShowInVisualisationType(frame, 'table')) {
            tableFrames.push(frame);
          }
        } else {
          // We fallback to table if we do not have any better meta info about the dataframe.
          tableFrames.push(frame);
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
    })
  );

export const decorateWithGraphResult = (): MonoTypeOperatorFunction<ExplorePanelData> => inputStream =>
  inputStream.pipe(
    map(data => {
      if (data.error || !data.graphFrames.length) {
        return { ...data, graphResult: null };
      }

      // Set the field config of the value field to show graph lines
      const graphResult = [...data.graphFrames];
      for (const graph of graphResult) {
        const valueField = graph.fields.find(f => f.name === TIME_SERIES_VALUE_FIELD_NAME);
        if (valueField) {
          valueField.config = {
            custom: {
              axis: { label: '', side: AxisSide.Left, width: 60, grid: true },
              bars: { show: false },
              fill: { alpha: 0.1 },
              line: { show: true, width: 1 },
              nullValues: 'null',
              points: { show: false, radius: 4 },
            },
            ...valueField.config,
          };
        }
      }
      return { ...data, graphResult };
    })
  );

export const decorateWithTableResult = (): MonoTypeOperatorFunction<ExplorePanelData> => inputStream =>
  inputStream.pipe(
    mergeMap(data => {
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
    })
  );

export const decorateWithLogsResult = (
  state: ExploreItemState
): MonoTypeOperatorFunction<ExplorePanelData> => inputStream =>
  inputStream.pipe(
    map(data => {
      if (data.error) {
        return { ...data, logsResult: null };
      }

      const { absoluteRange, refreshInterval } = state;
      if (data.logsFrames.length === 0) {
        return { ...data, logsResult: null };
      }

      const timeZone = data.request?.timezone ?? 'browser';
      const intervalMs = data.request?.intervalMs;
      const newResults = dataFrameToLogsModel(data.logsFrames, intervalMs, timeZone, absoluteRange);
      const sortOrder = refreshIntervalToSortOrder(refreshInterval);
      const sortedNewResults = sortLogsResult(newResults, sortOrder);
      const rows = sortedNewResults.rows;
      const series = sortedNewResults.series;
      const logsResult = { ...sortedNewResults, rows, series };

      return { ...data, logsResult };
    })
  );

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
