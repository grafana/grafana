import { groupBy, mapValues } from 'lodash';
import { Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import {
  AbsoluteTimeRange,
  DataFrame,
  FieldType,
  getDisplayProcessor,
  PanelData,
  standardTransformers,
  preProcessPanelData,
  DataLinkConfigOrigin,
  getRawDisplayProcessor,
  DataSourceApi,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import { refreshIntervalToSortOrder } from '../../../core/utils/explore';
import { ExplorePanelData } from '../../../types';
import { CorrelationData } from '../../correlations/useCorrelations';
import { attachCorrelationsToDataFrames } from '../../correlations/utils';
import { dataFrameToLogsModel } from '../../logs/logsModel';
import { sortLogsResult } from '../../logs/utils';
import { hasPanelPlugin } from '../../plugins/importPanelPlugin';

/**
 * When processing response first we try to determine what kind of dataframes we got as one query can return multiple
 * dataFrames with different type of data. This is later used for type specific processing. As we use this in
 * Observable pipeline, it decorates the existing panelData to pass the results to later processing stages.
 */
export const decorateWithFrameTypeMetadata = (data: PanelData): ExplorePanelData => {
  const graphFrames: DataFrame[] = [];
  const tableFrames: DataFrame[] = [];
  const rawPrometheusFrames: DataFrame[] = [];
  const logsFrames: DataFrame[] = [];
  const traceFrames: DataFrame[] = [];
  const nodeGraphFrames: DataFrame[] = [];
  const flameGraphFrames: DataFrame[] = [];
  const customFrames: DataFrame[] = [];

  for (const frame of data.series) {
    if (canFindPanel(frame)) {
      customFrames.push(frame);
      continue;
    }
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
      case 'rawPrometheus':
        rawPrometheusFrames.push(frame);
        break;
      case 'nodeGraph':
        nodeGraphFrames.push(frame);
        break;
      case 'flamegraph':
        flameGraphFrames.push(frame);
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
    nodeGraphFrames,
    customFrames,
    flameGraphFrames,
    rawPrometheusFrames,
    graphResult: null,
    tableResult: null,
    logsResult: null,
    rawPrometheusResult: null,
  };
};

export const decorateWithCorrelations = ({
  showCorrelationEditorLinks,
  queries,
  correlations,
  defaultTargetDatasource,
}: {
  showCorrelationEditorLinks: boolean;
  queries: DataQuery[] | undefined;
  correlations: CorrelationData[] | undefined;
  defaultTargetDatasource?: DataSourceApi;
}) => {
  return (data: PanelData): PanelData => {
    if (showCorrelationEditorLinks && defaultTargetDatasource) {
      for (const frame of data.series) {
        for (const field of frame.fields) {
          field.config.links = []; // hide all previous links, we only want to show fake correlations in this view

          field.display = field.display || getRawDisplayProcessor();

          const availableVars: Record<string, string> = {};
          frame.fields.map((field) => {
            availableVars[`${field.name}`] = "${__data.fields.['" + `${field.name}` + `']}`;
          });

          field.config.links.push({
            url: '',
            origin: DataLinkConfigOrigin.ExploreCorrelationsEditor,
            title: `Correlate with ${field.name}`,
            internal: {
              datasourceUid: defaultTargetDatasource.uid,
              datasourceName: defaultTargetDatasource.name,
              query: { datasource: { uid: defaultTargetDatasource.uid } },
            },
            meta: {
              correlationData: { resultField: field.name, vars: availableVars, origVars: availableVars },
            },
          });
        }
      }
    } else if (queries?.length && correlations?.length) {
      const queryRefIdToDataSourceUid = mapValues(groupBy(queries, 'refId'), '0.datasource.uid');
      attachCorrelationsToDataFrames(data.series, correlations, queryRefIdToDataSourceUid);
    }
    return data;
  };
};

export const decorateWithGraphResult = (data: ExplorePanelData): ExplorePanelData => {
  if (!data.graphFrames.length) {
    return { ...data, graphResult: null };
  }

  return { ...data, graphResult: data.graphFrames };
};

/**
 * This processing returns Observable because it uses Transformer internally which result type is also Observable.
 * In this case the transformer should return single result, but it is possible that in the future it could return
 * multiple results and so this should be used with mergeMap or similar to unbox the internal observable.
 */
export const decorateWithTableResult = (data: ExplorePanelData): Observable<ExplorePanelData> => {
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

  const hasOnlyTimeseries = data.tableFrames.every((df) => isTimeSeries(df));
  const transformContext = {
    interpolate: (v: string) => v,
  };

  // If we have only timeseries we do join on default time column which makes more sense. If we are showing
  // non timeseries or some mix of data we are not trying to join on anything and just try to merge them in
  // single table, which may not make sense in most cases, but it's up to the user to query something sensible.
  const transformer = hasOnlyTimeseries
    ? of(data.tableFrames).pipe(standardTransformers.joinByFieldTransformer.operator({}, transformContext))
    : of(data.tableFrames).pipe(standardTransformers.mergeTransformer.operator({}, transformContext));

  return transformer.pipe(
    map((frames) => {
      for (const frame of frames) {
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
      }

      return { ...data, tableResult: frames };
    })
  );
};

export const decorateWithRawPrometheusResult = (data: ExplorePanelData): Observable<ExplorePanelData> => {
  // Prometheus has a custom frame visualization alongside the table view, but they both handle the data the same
  const tableFrames = data.rawPrometheusFrames;

  if (!tableFrames || tableFrames.length === 0) {
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
  const transformContext = {
    interpolate: (v: string) => v,
  };

  // If we have only timeseries we do join on default time column which makes more sense. If we are showing
  // non timeseries or some mix of data we are not trying to join on anything and just try to merge them in
  // single table, which may not make sense in most cases, but it's up to the user to query something sensible.
  const transformer = hasOnlyTimeseries
    ? of(tableFrames).pipe(standardTransformers.joinByFieldTransformer.operator({}, transformContext))
    : of(tableFrames).pipe(standardTransformers.mergeTransformer.operator({}, transformContext));

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

      return { ...data, rawPrometheusResult: frame };
    })
  );
};

export const decorateWithLogsResult =
  (
    options: {
      absoluteRange?: AbsoluteTimeRange;
      refreshInterval?: string;
      queries?: DataQuery[];
      deduplicate?: boolean;
    } = {}
  ) =>
  (data: ExplorePanelData): ExplorePanelData => {
    if (data.logsFrames.length === 0) {
      return { ...data, logsResult: null };
    }

    const intervalMs = data.request?.intervalMs;
    const newResults = dataFrameToLogsModel(
      data.logsFrames,
      intervalMs,
      options.absoluteRange,
      options.queries,
      options.deduplicate
    );
    const sortOrder = refreshIntervalToSortOrder(options.refreshInterval);
    const sortedNewResults = sortLogsResult(newResults, sortOrder);
    const rows = sortedNewResults.rows;
    const series = sortedNewResults.series;
    const logsResult = { ...sortedNewResults, rows, series };

    return { ...data, logsResult };
  };

// decorateData applies all decorators
export function decorateData(
  data: PanelData,
  queryResponse: PanelData,
  logsResultDecorator: (data: ExplorePanelData) => ExplorePanelData,
  queries: DataQuery[] | undefined,
  correlations: CorrelationData[] | undefined,
  showCorrelationEditorLinks: boolean,
  defaultCorrelationTargetDatasource?: DataSourceApi
): Observable<ExplorePanelData> {
  return of(data).pipe(
    map((data: PanelData) => preProcessPanelData(data, queryResponse)),
    map(
      decorateWithCorrelations({
        defaultTargetDatasource: defaultCorrelationTargetDatasource,
        showCorrelationEditorLinks,
        queries,
        correlations,
      })
    ),
    map(decorateWithFrameTypeMetadata),
    map(decorateWithGraphResult),
    map(logsResultDecorator),
    mergeMap(decorateWithRawPrometheusResult),
    mergeMap(decorateWithTableResult)
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

/**
 * Can we find a panel that matches the type defined on the frame
 *
 * @param frame
 */
function canFindPanel(frame: DataFrame): boolean {
  if (!!frame.meta?.preferredVisualisationPluginId) {
    return hasPanelPlugin(frame.meta?.preferredVisualisationPluginId);
  }
  return false;
}
