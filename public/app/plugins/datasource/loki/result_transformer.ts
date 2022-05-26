import { capitalize, groupBy, isEmpty } from 'lodash';
import { of } from 'rxjs';
import { v5 as uuidv5 } from 'uuid';

import {
  FieldType,
  TimeSeries,
  Labels,
  DataFrame,
  ArrayVector,
  MutableDataFrame,
  findUniqueLabels,
  DataFrameView,
  DataLink,
  Field,
  QueryResultMetaStat,
  QueryResultMeta,
  TimeSeriesValue,
  ScopedVars,
  toDataFrame,
} from '@grafana/data';
import { getTemplateSrv, getDataSourceSrv } from '@grafana/runtime';
import TableModel from 'app/core/table_model';

import { renderLegendFormat } from '../prometheus/legend';

import { formatQuery, getHighlighterExpressionsFromQuery } from './query_utils';
import { dataFrameHasLokiError } from './responseUtils';
import {
  LokiRangeQueryRequest,
  LokiResponse,
  LokiMatrixResult,
  LokiVectorResult,
  TransformerOptions,
  LokiResultType,
  LokiStreamResult,
  LokiTailResponse,
  LokiQuery,
  LokiOptions,
  DerivedFieldConfig,
  LokiStreamResponse,
  LokiStats,
} from './types';

const UUID_NAMESPACE = '6ec946da-0f49-47a8-983a-1d76d17e7c92';

/**
 * Transforms LokiStreamResult structure into a dataFrame. Used when doing standard queries
 */
export function lokiStreamsToRawDataFrame(streams: LokiStreamResult[], refId?: string): DataFrame {
  const labels = new ArrayVector<{}>([]);
  const times = new ArrayVector<string>([]);
  const timesNs = new ArrayVector<string>([]);
  const lines = new ArrayVector<string>([]);
  const uids = new ArrayVector<string>([]);

  // We need to store and track all used uids to ensure that uids are unique
  const usedUids: { string?: number } = {};

  for (const stream of streams) {
    const streamLabels: Labels = stream.stream;
    const labelsString = Object.entries(streamLabels)
      .map(([key, val]) => `${key}="${val}"`)
      .sort()
      .join('');

    for (const [ts, line] of stream.values) {
      labels.add(streamLabels);
      // num ns epoch in string, we convert it to iso string here so it matches old format
      times.add(new Date(parseInt(ts.slice(0, -6), 10)).toISOString());
      timesNs.add(ts);
      lines.add(line);
      uids.add(createUid(ts, labelsString, line, usedUids, refId));
    }
  }

  return constructDataFrame(times, timesNs, lines, uids, labels, refId);
}

/**
 * Constructs dataFrame with supplied fields and other data.
 */
function constructDataFrame(
  times: ArrayVector<string>,
  timesNs: ArrayVector<string>,
  lines: ArrayVector<string>,
  uids: ArrayVector<string>,
  labels: ArrayVector<{}>,
  refId?: string
) {
  const dataFrame = {
    refId,
    fields: [
      { name: 'labels', type: FieldType.other, config: {}, values: labels },
      { name: 'Time', type: FieldType.time, config: {}, values: times }, // Time
      { name: 'Line', type: FieldType.string, config: {}, values: lines }, // Line - needs to be the first field with string type
      { name: 'tsNs', type: FieldType.time, config: {}, values: timesNs }, // Time
      { name: 'id', type: FieldType.string, config: {}, values: uids },
    ],
    length: times.length,
  };

  return dataFrame;
}

/**
 * Transform LokiResponse data and appends it to MutableDataFrame. Used for streaming where the dataFrame can be
 * a CircularDataFrame creating a fixed size rolling buffer.
 * TODO: Probably could be unified with the logStreamToDataFrame function.
 * @param response
 * @param data Needs to have ts, line, labels, id as fields
 */
export function appendResponseToBufferedData(response: LokiTailResponse, data: MutableDataFrame) {
  // Should we do anything with: response.dropped_entries?

  const streams: LokiStreamResult[] = response.streams;
  if (!streams || !streams.length) {
    return;
  }

  let baseLabels: Labels = {};
  for (const f of data.fields) {
    if (f.type === FieldType.string) {
      if (f.labels) {
        baseLabels = f.labels;
      }
      break;
    }
  }

  const labelsField = data.fields[0];
  const tsField = data.fields[1];
  const lineField = data.fields[2];
  const idField = data.fields[3];
  const tsNsField = data.fields[4];

  // We are comparing used ids only within the received stream. This could be a problem if the same line + labels + nanosecond timestamp came in 2 separate batches.
  // As this is very unlikely, and the result would only affect live-tailing css animation we have decided to not compare all received uids from data param as this would slow down processing.
  const usedUids: { string?: number } = {};

  for (const stream of streams) {
    // Find unique labels
    const unique = findUniqueLabels(stream.stream, baseLabels);
    const allLabelsString = Object.entries(stream.stream)
      .map(([key, val]) => `${key}="${val}"`)
      .sort()
      .join('');

    // Add each line
    for (const [ts, line] of stream.values) {
      tsField.values.add(new Date(parseInt(ts.slice(0, -6), 10)).toISOString());
      tsNsField.values.add(ts);
      lineField.values.add(line);
      labelsField.values.add(unique);
      idField.values.add(createUid(ts, allLabelsString, line, usedUids, data.refId));
    }
  }
}

function createUid(ts: string, labelsString: string, line: string, usedUids: any, refId?: string): string {
  // Generate id as hashed nanosecond timestamp, labels and line (this does not have to be unique)
  let id = uuidv5(`${ts}_${labelsString}_${line}`, UUID_NAMESPACE);

  // Check if generated id is unique
  // If not and we've already used it, append it's count after it
  if (id in usedUids) {
    // Increase the count
    const newCount = usedUids[id] + 1;
    usedUids[id] = newCount;
    // Append count to generated id to make it unique
    id = `${id}_${newCount}`;
  } else {
    // If id is unique and wasn't used, add it to usedUids and start count at 0
    usedUids[id] = 0;
  }
  // Return unique id
  if (refId) {
    return `${id}_${refId}`;
  }
  return id;
}

function lokiMatrixToTimeSeries(matrixResult: LokiMatrixResult, options: TransformerOptions): TimeSeries {
  const name = createMetricLabel(matrixResult.metric, options);
  return {
    target: name,
    title: name,
    datapoints: lokiPointsToTimeseriesPoints(matrixResult.values),
    tags: matrixResult.metric,
    meta: options.meta,
    refId: options.refId,
  };
}

function parsePrometheusFormatSampleValue(value: string): number {
  switch (value) {
    case '+Inf':
      return Number.POSITIVE_INFINITY;
    case '-Inf':
      return Number.NEGATIVE_INFINITY;
    default:
      return parseFloat(value);
  }
}

export function lokiPointsToTimeseriesPoints(data: Array<[number, string]>): TimeSeriesValue[][] {
  const datapoints: TimeSeriesValue[][] = [];

  for (const [time, value] of data) {
    let datapointValue: TimeSeriesValue = parsePrometheusFormatSampleValue(value);

    const timestamp = time * 1000;

    datapoints.push([datapointValue, timestamp]);
  }

  return datapoints;
}

export function lokiResultsToTableModel(
  lokiResults: Array<LokiMatrixResult | LokiVectorResult>,
  resultCount: number,
  refId: string,
  meta: QueryResultMeta
): TableModel {
  if (!lokiResults || lokiResults.length === 0) {
    return new TableModel();
  }

  // Collect all labels across all metrics
  const metricLabels: Set<string> = new Set<string>(
    lokiResults.reduce((acc, cur) => acc.concat(Object.keys(cur.metric)), [] as string[])
  );

  // Sort metric labels, create columns for them and record their index
  const sortedLabels = [...metricLabels.values()].sort();
  const table = new TableModel();
  table.refId = refId;
  table.meta = meta;
  table.columns = [
    { text: 'Time', type: FieldType.time },
    ...sortedLabels.map((label) => ({ text: label, filterable: true, type: FieldType.string })),
    { text: `Value #${refId}`, type: FieldType.number },
  ];

  // Populate rows, set value to empty string when label not present.
  lokiResults.forEach((series) => {
    const newSeries: LokiMatrixResult = {
      metric: series.metric,
      values: (series as LokiVectorResult).value
        ? [(series as LokiVectorResult).value]
        : (series as LokiMatrixResult).values,
    };

    if (!newSeries.values) {
      return;
    }

    if (!newSeries.metric) {
      table.rows.concat(newSeries.values.map(([a, b]) => [a * 1000, parseFloat(b)]));
    } else {
      table.rows.push(
        ...newSeries.values.map(([a, b]) => [
          a * 1000,
          ...sortedLabels.map((label) => newSeries.metric[label] || ''),
          parseFloat(b),
        ])
      );
    }
  });

  return table;
}

export function createMetricLabel(labelData: { [key: string]: string }, options?: TransformerOptions) {
  let label =
    options === undefined || isEmpty(options.legendFormat)
      ? getOriginalMetricName(labelData)
      : renderLegendFormat(getTemplateSrv().replace(options.legendFormat ?? '', options.scopedVars), labelData);

  if (!label && options) {
    label = options.query;
  }
  return label;
}

function getOriginalMetricName(labelData: { [key: string]: string }) {
  const labelPart = Object.entries(labelData)
    .map((label) => `${label[0]}="${label[1]}"`)
    .join(',');
  return `{${labelPart}}`;
}

export function decamelize(s: string): string {
  return s.replace(/[A-Z]/g, (m) => ` ${m.toLowerCase()}`);
}

// Turn loki stats { metric: value } into meta stat { title: metric, value: value }
function lokiStatsToMetaStat(stats: LokiStats | undefined): QueryResultMetaStat[] {
  const result: QueryResultMetaStat[] = [];

  if (!stats) {
    return result;
  }

  for (const section in stats) {
    const values = stats[section];
    for (const label in values) {
      const value = values[label];
      let unit;
      if (/time/i.test(label) && value) {
        unit = 's';
      } else if (/bytes.*persecond/i.test(label)) {
        unit = 'Bps';
      } else if (/bytes/i.test(label)) {
        unit = 'decbytes';
      }
      const title = `${capitalize(section)}: ${decamelize(label)}`;
      result.push({ displayName: title, value, unit });
    }
  }

  return result;
}

export function lokiStreamsToDataFrames(
  response: LokiStreamResponse,
  target: LokiQuery,
  limit: number,
  config: LokiOptions
): DataFrame[] {
  const data = limit > 0 ? response.data.result : [];
  const stats: QueryResultMetaStat[] = lokiStatsToMetaStat(response.data.stats);
  // Use custom mechanism to identify which stat we want to promote to label
  const custom = {
    lokiQueryStatKey: 'Summary: total bytes processed',
    // TODO: when we get a real frame-type in @grafana/data
    // move this to frame.meta.type
    frameType: 'LabeledTimeValues',
  };

  const meta: QueryResultMeta = {
    searchWords: getHighlighterExpressionsFromQuery(formatQuery(target.expr)),
    limit,
    stats,
    custom,
    preferredVisualisationType: 'logs',
  };

  const dataFrame = lokiStreamsToRawDataFrame(data, target.refId);
  enhanceDataFrame(dataFrame, config);

  if (meta.custom && dataFrameHasLokiError(dataFrame)) {
    meta.custom.error = 'Error when parsing some of the logs';
  }

  if (stats.length && !data.length) {
    return [
      {
        fields: [],
        length: 0,
        refId: target.refId,
        meta,
      },
    ];
  }

  return [
    {
      ...dataFrame,
      refId: target.refId,
      meta,
    },
  ];
}

/**
 * Adds new fields and DataLinks to DataFrame based on DataSource instance config.
 */
export const enhanceDataFrame = (dataFrame: DataFrame, config: LokiOptions | null): void => {
  if (!config) {
    return;
  }

  const derivedFields = config.derivedFields ?? [];
  if (!derivedFields.length) {
    return;
  }
  const derivedFieldsGrouped = groupBy(derivedFields, 'name');

  const newFields = Object.values(derivedFieldsGrouped).map(fieldFromDerivedFieldConfig);

  const view = new DataFrameView(dataFrame);
  view.forEach((row: { Line: string }) => {
    for (const field of newFields) {
      const logMatch = row.Line.match(derivedFieldsGrouped[field.name][0].matcherRegex);
      field.values.add(logMatch && logMatch[1]);
    }
  });

  dataFrame.fields = [...dataFrame.fields, ...newFields];
};

/**
 * Transform derivedField config into dataframe field with config that contains link.
 */
function fieldFromDerivedFieldConfig(derivedFieldConfigs: DerivedFieldConfig[]): Field<any, ArrayVector> {
  const dataSourceSrv = getDataSourceSrv();

  const dataLinks = derivedFieldConfigs.reduce((acc, derivedFieldConfig) => {
    // Having field.datasourceUid means it is an internal link.
    if (derivedFieldConfig.datasourceUid) {
      const dsSettings = dataSourceSrv.getInstanceSettings(derivedFieldConfig.datasourceUid);

      acc.push({
        // Will be filled out later
        title: derivedFieldConfig.urlDisplayLabel || '',
        url: '',
        // This is hardcoded for Jaeger or Zipkin not way right now to specify datasource specific query object
        internal: {
          query: { query: derivedFieldConfig.url },
          datasourceUid: derivedFieldConfig.datasourceUid,
          datasourceName: dsSettings?.name ?? 'Data source not found',
        },
      });
    } else if (derivedFieldConfig.url) {
      acc.push({
        // We do not know what title to give here so we count on presentation layer to create a title from metadata.
        title: derivedFieldConfig.urlDisplayLabel || '',
        // This is hardcoded for Jaeger or Zipkin not way right now to specify datasource specific query object
        url: derivedFieldConfig.url,
      });
    }
    return acc;
  }, [] as DataLink[]);

  return {
    name: derivedFieldConfigs[0].name,
    type: FieldType.string,
    config: {
      links: dataLinks,
    },
    // We are adding values later on
    values: new ArrayVector<string>([]),
  };
}

function rangeQueryResponseToTimeSeries(
  response: LokiResponse,
  query: LokiRangeQueryRequest,
  target: LokiQuery,
  scopedVars: ScopedVars
): TimeSeries[] {
  /** Show results of Loki metric queries only in graph */
  const meta: QueryResultMeta = {
    preferredVisualisationType: 'graph',
  };
  const transformerOptions: TransformerOptions = {
    legendFormat: target.legendFormat ?? '',
    query: query.query,
    refId: target.refId,
    meta,
    scopedVars,
  };

  switch (response.data.resultType) {
    case LokiResultType.Vector:
      return response.data.result.map((vecResult) =>
        lokiMatrixToTimeSeries({ metric: vecResult.metric, values: [vecResult.value] }, transformerOptions)
      );
    case LokiResultType.Matrix:
      return response.data.result.map((matrixResult) => lokiMatrixToTimeSeries(matrixResult, transformerOptions));
    default:
      return [];
  }
}

export function rangeQueryResponseToDataFrames(
  response: LokiResponse,
  query: LokiRangeQueryRequest,
  target: LokiQuery,
  scopedVars: ScopedVars
): DataFrame[] {
  const series = rangeQueryResponseToTimeSeries(response, query, target, scopedVars);
  const frames = series.map((s) => toDataFrame(s));

  const { step } = query;

  if (step != null) {
    const intervalMs = step * 1000;

    frames.forEach((frame) => {
      frame.fields.forEach((field) => {
        if (field.type === FieldType.time) {
          field.config.interval = intervalMs;
        }
      });
    });
  }

  return frames;
}

export function processRangeQueryResponse(
  response: LokiResponse,
  target: LokiQuery,
  query: LokiRangeQueryRequest,
  limit: number,
  config: LokiOptions,
  scopedVars: ScopedVars
) {
  switch (response.data.resultType) {
    case LokiResultType.Stream:
      return of({
        data: lokiStreamsToDataFrames(response as LokiStreamResponse, target, limit, config),
        key: `${target.refId}_log`,
      });

    case LokiResultType.Vector:
    case LokiResultType.Matrix:
      return of({
        data: rangeQueryResponseToDataFrames(response, query, target, scopedVars),
        key: target.refId,
      });
    default:
      throw new Error(`Unknown result type "${(response.data as any).resultType}".`);
  }
}
