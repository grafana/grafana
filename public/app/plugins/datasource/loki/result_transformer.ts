import _ from 'lodash';

import {
  parseLabels,
  FieldType,
  TimeSeries,
  Labels,
  DataFrame,
  ArrayVector,
  MutableDataFrame,
  findUniqueLabels,
  dateTime,
} from '@grafana/data';
import templateSrv from 'app/features/templating/template_srv';
import TableModel from 'app/core/table_model';
import {
  LokiLegacyStreamResult,
  LokiResponse,
  LokiMatrixResult,
  LokiVectorResult,
  TransformerOptions,
  LokiLegacyStreamResponse,
  LokiResultType,
  LokiStreamResult,
} from './types';

/**
 * Transforms LokiLogStream structure into a dataFrame. Used when doing standard queries.
 */
export function legacyLogStreamToDataFrame(
  stream: LokiLegacyStreamResult,
  reverse?: boolean,
  refId?: string
): DataFrame {
  let labels: Labels = stream.parsedLabels;
  if (!labels && stream.labels) {
    labels = parseLabels(stream.labels);
  }
  const times = new ArrayVector<string>([]);
  const lines = new ArrayVector<string>([]);
  const uids = new ArrayVector<string>([]);

  for (const entry of stream.entries) {
    const ts = entry.ts || entry.timestamp;
    times.add(ts);
    lines.add(entry.line);
    uids.add(`${ts}_${stream.labels}`);
  }

  if (reverse) {
    times.buffer = times.buffer.reverse();
    lines.buffer = lines.buffer.reverse();
  }

  return {
    refId,
    fields: [
      { name: 'ts', type: FieldType.time, config: { title: 'Time' }, values: times }, // Time
      { name: 'line', type: FieldType.string, config: {}, values: lines, labels }, // Line
      { name: 'id', type: FieldType.string, config: {}, values: uids },
    ],
    length: times.length,
  };
}

export function lokiStreamResultToDataFrame(stream: LokiStreamResult, reverse?: boolean, refId?: string): DataFrame {
  const labels: Labels = stream.stream;

  const times = new ArrayVector<string>([]);
  const lines = new ArrayVector<string>([]);
  const uids = new ArrayVector<string>([]);

  for (const [ts, line] of stream.values) {
    times.add(dateTime(Number.parseFloat(ts) / 1e6).format('YYYY-MM-DD HH:mm:ss'));
    lines.add(line);
    uids.add(
      `${ts}_${Object.entries(labels)
        .map(([key, val]) => `${key}=${val}`)
        .join('')}`
    );
  }

  if (reverse) {
    times.buffer = times.buffer.reverse();
    lines.buffer = lines.buffer.reverse();
  }

  return {
    refId,
    labels,
    fields: [
      { name: 'ts', type: FieldType.time, config: { title: 'Time' }, values: times }, // Time
      { name: 'line', type: FieldType.string, config: {}, values: lines }, // Line
      { name: 'id', type: FieldType.string, config: {}, values: uids },
    ],
    length: times.length,
  };
}

/**
 * Transform LokiResponse data and appends it to MutableDataFrame. Used for streaming where the dataFrame can be
 * a CircularDataFrame creating a fixed size rolling buffer.
 * TODO: Probably could be unified with the logStreamToDataFrame function.
 * @param response
 * @param data Needs to have ts, line, labels, id as fields
 */
export function appendResponseToBufferedData(response: LokiLegacyStreamResponse, data: MutableDataFrame) {
  // Should we do anything with: response.dropped_entries?

  const streams: LokiLegacyStreamResult[] = response.streams;
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
    const labels = parseLabels(stream.labels);
    const unique = findUniqueLabels(labels, baseLabels);

    // Add each line
    for (const entry of stream.entries) {
      const ts = entry.ts || entry.timestamp;
      data.values.ts.add(ts);
      data.values.line.add(entry.line);
      data.values.labels.add(unique);
      data.values.id.add(`${ts}_${stream.labels}`);
    }
  }
}

export function rangeQueryResponseToTimeSeries(response: LokiResponse, options: TransformerOptions): TimeSeries[] {
  switch (response.data.resultType) {
    case LokiResultType.Vector:
      return response.data.result.map(vecResult =>
        lokiMatrixToTimeSeries({ metric: vecResult.metric, values: [vecResult.value] }, options)
      );
    case LokiResultType.Matrix:
      return response.data.result.map(matrixResult => lokiMatrixToTimeSeries(matrixResult, options));
    default:
      return [];
  }
}

function lokiMatrixToTimeSeries(matrixResult: LokiMatrixResult, options: TransformerOptions): TimeSeries {
  return {
    target: createMetricLabel(matrixResult.metric, options),
    datapoints: lokiPointsToTimeseriesPoints(matrixResult.values, options),
    tags: matrixResult.metric,
  };
}

function lokiPointsToTimeseriesPoints(
  data: Array<[number, string]>,
  options: TransformerOptions
): Array<[number, number]> {
  const stepMs = options.step * 1000;
  const datapoints: Array<[number, number]> = [];

  let baseTimestampMs = options.start / 1e6;
  for (const [time, value] of data) {
    let datapointValue = parseFloat(value);
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
  valueWithRefId?: boolean
): TableModel {
  if (!lokiResults || lokiResults.length === 0) {
    return new TableModel();
  }

  // Collect all labels across all metrics
  const metricLabels: Set<string> = new Set<string>(
    lokiResults.reduce((acc, cur) => acc.concat(Object.keys(cur.metric)), [])
  );

  // Sort metric labels, create columns for them and record their index
  const sortedLabels = [...metricLabels.values()].sort();
  const table = new TableModel();
  table.columns = [
    { text: 'Time', type: FieldType.time },
    ...sortedLabels.map(label => ({ text: label, filterable: true })),
    { text: resultCount > 1 || valueWithRefId ? `Value #${refId}` : 'Value', type: FieldType.time },
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
      const coolRows = newSeries.values.map(([a, b]) => [
        a * 1000,
        ...sortedLabels.map(label => newSeries.metric[label] || ''),
        parseFloat(b),
      ]);
      table.rows.push(...coolRows);
    }
  });

  return table;
}

function createMetricLabel(labelData: { [key: string]: string }, options?: TransformerOptions) {
  let label =
    options === undefined || _.isEmpty(options.legendFormat)
      ? getOriginalMetricName(labelData)
      : renderTemplate(templateSrv.replace(options.legendFormat), labelData);

  if (!label || label === '{}') {
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
