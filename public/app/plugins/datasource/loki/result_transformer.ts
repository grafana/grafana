import _ from 'lodash';
import md5 from 'md5';
import { of } from 'rxjs';

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
} from '@grafana/data';

import { getTemplateSrv } from '@grafana/runtime';
import TableModel from 'app/core/table_model';
import { formatQuery, getHighlighterExpressionsFromQuery } from './query_utils';
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

/**
 * Transforms LokiStreamResult structure into a dataFrame. Used when doing standard queries and newer version of Loki.
 */
export function lokiStreamResultToDataFrame(stream: LokiStreamResult, reverse?: boolean, refId?: string): DataFrame {
  const labels: Labels = stream.stream;
  const labelsString = Object.entries(labels)
    .map(([key, val]) => `${key}="${val}"`)
    .sort()
    .join('');

  const times = new ArrayVector<string>([]);
  const timesNs = new ArrayVector<string>([]);
  const lines = new ArrayVector<string>([]);
  const uids = new ArrayVector<string>([]);

  for (const [ts, line] of stream.values) {
    // num ns epoch in string, we convert it to iso string here so it matches old format
    times.add(new Date(parseInt(ts.substr(0, ts.length - 6), 10)).toISOString());
    timesNs.add(ts);
    lines.add(line);
    uids.add(createUid(ts, labelsString, line));
  }

  return constructDataFrame(times, timesNs, lines, uids, labels, reverse, refId);
}

/**
 * Constructs dataFrame with supplied fields and other data. Also makes sure it is properly reversed if needed.
 */
function constructDataFrame(
  times: ArrayVector<string>,
  timesNs: ArrayVector<string>,
  lines: ArrayVector<string>,
  uids: ArrayVector<string>,
  labels: Labels,
  reverse?: boolean,
  refId?: string
) {
  const dataFrame = {
    refId,
    fields: [
      { name: 'ts', type: FieldType.time, config: { displayName: 'Time' }, values: times }, // Time
      { name: 'line', type: FieldType.string, config: {}, values: lines, labels }, // Line - needs to be the first field with string type
      { name: 'id', type: FieldType.string, config: {}, values: uids },
      { name: 'tsNs', type: FieldType.time, config: { displayName: 'Time ns' }, values: timesNs }, // Time
    ],
    length: times.length,
  };

  if (reverse) {
    const mutableDataFrame = new MutableDataFrame(dataFrame);
    mutableDataFrame.reverse();
    return mutableDataFrame;
  }

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

  for (const stream of streams) {
    // Find unique labels
    const unique = findUniqueLabels(stream.stream, baseLabels);
    const allLabelsString = Object.entries(stream.stream)
      .map(([key, val]) => `${key}="${val}"`)
      .sort()
      .join('');

    // Add each line
    for (const [ts, line] of stream.values) {
      data.values.ts.add(new Date(parseInt(ts.substr(0, ts.length - 6), 10)).toISOString());
      data.values.tsNs.add(ts);
      data.values.line.add(line);
      data.values.labels.add(unique);
      data.values.id.add(createUid(ts, allLabelsString, line));
    }
  }
}

function createUid(ts: string, labelsString: string, line: string): string {
  return md5(`${ts}_${labelsString}_${line}`);
}

function lokiMatrixToTimeSeries(matrixResult: LokiMatrixResult, options: TransformerOptions): TimeSeries {
  const name = createMetricLabel(matrixResult.metric, options);
  return {
    target: name,
    title: name,
    datapoints: lokiPointsToTimeseriesPoints(matrixResult.values, options),
    tags: matrixResult.metric,
    meta: options.meta,
    refId: options.refId,
  };
}

function lokiPointsToTimeseriesPoints(data: Array<[number, string]>, options: TransformerOptions): TimeSeriesValue[][] {
  const stepMs = options.step * 1000;
  const datapoints: TimeSeriesValue[][] = [];

  let baseTimestampMs = options.start / 1e6;
  for (const [time, value] of data) {
    let datapointValue: TimeSeriesValue = parseFloat(value);

    if (isNaN(datapointValue)) {
      datapointValue = null;
    }

    const timestamp = time * 1000;
    for (let t = baseTimestampMs; t < timestamp; t += stepMs) {
      datapoints.push([0, t]);
    }

    baseTimestampMs = timestamp + stepMs;
    datapoints.push([datapointValue, timestamp]);
  }

  const endTimestamp = options.end / 1e6;
  for (let t = baseTimestampMs; t <= endTimestamp; t += stepMs) {
    datapoints.push([0, t]);
  }

  return datapoints;
}

export function lokiResultsToTableModel(
  lokiResults: Array<LokiMatrixResult | LokiVectorResult>,
  resultCount: number,
  refId: string,
  meta: QueryResultMeta,
  valueWithRefId?: boolean
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
    ...sortedLabels.map(label => ({ text: label, filterable: true })),
    { text: resultCount > 1 || valueWithRefId ? `Value #${refId}` : 'Value', type: FieldType.number },
  ];

  // Populate rows, set value to empty string when label not present.
  lokiResults.forEach(series => {
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
          ...sortedLabels.map(label => newSeries.metric[label] || ''),
          parseFloat(b),
        ])
      );
    }
  });

  return table;
}

export function createMetricLabel(labelData: { [key: string]: string }, options?: TransformerOptions) {
  let label =
    options === undefined || _.isEmpty(options.legendFormat)
      ? getOriginalMetricName(labelData)
      : renderTemplate(getTemplateSrv().replace(options.legendFormat ?? '', options.scopedVars), labelData);

  if (!label && options) {
    label = options.query;
  }
  return label;
}

function renderTemplate(aliasPattern: string, aliasData: { [key: string]: string }) {
  const aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
  return aliasPattern.replace(aliasRegex, (_, g1) => (aliasData[g1] ? aliasData[g1] : g1));
}

function getOriginalMetricName(labelData: { [key: string]: string }) {
  const metricName = labelData.__name__ || '';
  delete labelData.__name__;
  const labelPart = Object.entries(labelData)
    .map(label => `${label[0]}="${label[1]}"`)
    .join(',');
  return `${metricName}{${labelPart}}`;
}

export function decamelize(s: string): string {
  return s.replace(/[A-Z]/g, m => ` ${m.toLowerCase()}`);
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
      const title = `${_.capitalize(section)}: ${decamelize(label)}`;
      result.push({ displayName: title, value, unit });
    }
  }

  return result;
}

export function lokiStreamsToDataframes(
  response: LokiStreamResponse,
  target: { refId: string; expr?: string },
  limit: number,
  config: LokiOptions,
  reverse = false
): DataFrame[] {
  const data = limit > 0 ? response.data.result : [];
  const stats: QueryResultMetaStat[] = lokiStatsToMetaStat(response.data.stats);
  // Use custom mechanism to identify which stat we want to promote to label
  const custom = {
    lokiQueryStatKey: 'Summary: total bytes processed',
  };

  const meta: QueryResultMeta = {
    searchWords: getHighlighterExpressionsFromQuery(formatQuery(target.expr)),
    limit,
    stats,
    custom,
    preferredVisualisationType: 'logs',
  };

  const series: DataFrame[] = data.map(stream => {
    const dataFrame = lokiStreamResultToDataFrame(stream, reverse);
    enhanceDataFrame(dataFrame, config);

    return {
      ...dataFrame,
      refId: target.refId,
      meta,
    };
  });

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

  return series;
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
  const derivedFieldsGrouped = _.groupBy(derivedFields, 'name');

  const newFields = Object.values(derivedFieldsGrouped).map(fieldFromDerivedFieldConfig);

  const view = new DataFrameView(dataFrame);
  view.forEach((row: { line: string }) => {
    for (const field of newFields) {
      const logMatch = row.line.match(derivedFieldsGrouped[field.name][0].matcherRegex);
      field.values.add(logMatch && logMatch[1]);
    }
  });

  dataFrame.fields = [...dataFrame.fields, ...newFields];
};

/**
 * Transform derivedField config into dataframe field with config that contains link.
 */
function fieldFromDerivedFieldConfig(derivedFieldConfigs: DerivedFieldConfig[]): Field<any, ArrayVector> {
  const dataLinks = derivedFieldConfigs.reduce((acc, derivedFieldConfig) => {
    // Having field.datasourceUid means it is an internal link.
    if (derivedFieldConfig.datasourceUid) {
      acc.push({
        // Will be filled out later
        title: '',
        url: '',
        // This is hardcoded for Jaeger or Zipkin not way right now to specify datasource specific query object
        internal: {
          query: { query: derivedFieldConfig.url },
          datasourceUid: derivedFieldConfig.datasourceUid,
        },
      });
    } else if (derivedFieldConfig.url) {
      acc.push({
        // We do not know what title to give here so we count on presentation layer to create a title from metadata.
        title: '',
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

export function rangeQueryResponseToTimeSeries(
  response: LokiResponse,
  query: LokiRangeQueryRequest,
  target: LokiQuery,
  responseListLength: number,
  scopedVars: ScopedVars
): TimeSeries[] {
  /** Show results of Loki metric queries only in graph */
  const meta: QueryResultMeta = {
    preferredVisualisationType: 'graph',
  };
  const transformerOptions: TransformerOptions = {
    format: target.format,
    legendFormat: target.legendFormat ?? '',
    start: query.start!,
    end: query.end!,
    step: query.step!,
    query: query.query,
    responseListLength,
    refId: target.refId,
    meta,
    valueWithRefId: target.valueWithRefId,
    scopedVars,
  };

  switch (response.data.resultType) {
    case LokiResultType.Vector:
      return response.data.result.map(vecResult =>
        lokiMatrixToTimeSeries({ metric: vecResult.metric, values: [vecResult.value] }, transformerOptions)
      );
    case LokiResultType.Matrix:
      return response.data.result.map(matrixResult => lokiMatrixToTimeSeries(matrixResult, transformerOptions));
    default:
      return [];
  }
}

export function processRangeQueryResponse(
  response: LokiResponse,
  target: LokiQuery,
  query: LokiRangeQueryRequest,
  responseListLength: number,
  limit: number,
  config: LokiOptions,
  scopedVars: ScopedVars,
  reverse = false
) {
  switch (response.data.resultType) {
    case LokiResultType.Stream:
      return of({
        data: lokiStreamsToDataframes(response as LokiStreamResponse, target, limit, config, reverse),
        key: `${target.refId}_log`,
      });

    case LokiResultType.Vector:
    case LokiResultType.Matrix:
      return of({
        data: rangeQueryResponseToTimeSeries(
          response,
          query,
          {
            ...target,
            format: 'time_series',
          },
          responseListLength,
          scopedVars
        ),
        key: target.refId,
      });
    default:
      throw new Error(`Unknown result type "${(response.data as any).resultType}".`);
  }
}
