import saveAs from 'file-saver';

import {
  CSVConfig,
  DataFrame,
  DataFrameView,
  DataTransformerID,
  dateTimeFormat,
  LogsModel,
  MutableDataFrame,
  toCSV,
} from '@grafana/data';
import { transformToOTLP } from '@grafana-plugins/tempo/resultTransformer';

import { transformToJaeger } from '../../../plugins/datasource/jaeger/responseTransform';
import { transformToZipkin } from '../../../plugins/datasource/zipkin/utils/transforms';

/**
 * Downloads a DataFrame as a TXT file.
 *
 * @param {(Pick<LogsModel, 'meta' | 'rows'>)} logsModel
 * @param {string} title
 */
export function downloadLogsModelAsTxt(logsModel: Pick<LogsModel, 'meta' | 'rows'>, title: string) {
  let textToDownload = '';

  logsModel.meta?.forEach((metaItem) => {
    const string = `${metaItem.label}: ${JSON.stringify(metaItem.value)}\n`;
    textToDownload = textToDownload + string;
  });
  textToDownload = textToDownload + '\n\n';

  logsModel.rows.forEach((row) => {
    const newRow = dateTimeFormat(row.timeEpochMs, { defaultWithMS: true }) + '\t' + row.entry + '\n';
    textToDownload = textToDownload + newRow;
  });

  const blob = new Blob([textToDownload], {
    type: 'text/plain;charset=utf-8',
  });

  const fileName = `${title}-logs-${dateTimeFormat(new Date())}.txt`;
  saveAs(blob, fileName);
}

/**
 * Exports a DataFrame as a CSV file.
 *
 * @param {DataFrame} dataFrame
 * @param {string} title
 * @param {CSVConfig} [csvConfig]
 * @param {DataTransformerID} [transformId=DataTransformerID.noop]
 */
export function downloadDataFrameAsCsv(
  dataFrame: DataFrame,
  title: string,
  csvConfig?: CSVConfig,
  transformId: DataTransformerID = DataTransformerID.noop
) {
  const dataFrameCsv = toCSV([dataFrame], csvConfig);
  const bomChar = csvConfig?.useExcelHeader ? String.fromCharCode(0xfeff) : '';

  const blob = new Blob([bomChar, dataFrameCsv], {
    type: 'text/csv;charset=utf-8',
  });

  const transformation = transformId !== DataTransformerID.noop ? '-as-' + transformId.toLocaleLowerCase() : '';
  const fileName = `${title}-data${transformation}-${dateTimeFormat(new Date())}.csv`;
  saveAs(blob, fileName);
}

/**
 * Downloads any object as JSON file.
 *
 * @param {unknown} json
 * @param {string} title
 */
export function downloadAsJson(json: unknown, title: string) {
  const blob = new Blob([JSON.stringify(json)], {
    type: 'application/json',
  });

  const fileName = `${title}-${dateTimeFormat(new Date())}.json`;
  saveAs(blob, fileName);
}

/**
 * Downloads a trace as json, based on the DataFrame format or OTLP as a default
 *
 * @param {DataFrame} frame
 * @param {string} title
 */
export function downloadTraceAsJson(frame: DataFrame, title: string): string {
  let traceFormat = 'otlp';
  switch (frame.meta?.custom?.traceFormat) {
    case 'jaeger': {
      let res = transformToJaeger(new MutableDataFrame(frame));
      downloadAsJson(res, title);
      traceFormat = 'jaeger';
      break;
    }
    case 'zipkin': {
      let res = transformToZipkin(new MutableDataFrame(frame));
      downloadAsJson(res, title);
      traceFormat = 'zipkin';
      break;
    }
    case 'otlp':
    default: {
      let res = transformToOTLP(new MutableDataFrame(frame));
      downloadAsJson(res, title);
      break;
    }
  }
  return traceFormat;
}

interface Span {
  startTime: number;
  duration: number;
  spanID: string;
  operationName: string;
  serviceName: string;
}

export function exportTraceAsMermaid(frame: DataFrame, title: string, highlights: string[]): string {
  const view = new DataFrameView(frame);
  const spans: Span[] = view.toArray(); // Convert DataFrameView to an array of spans directly

  const sortedSpans = spans.sort((a, b) => a.startTime - b.startTime);
  const timeDelta = sortedSpans[0].startTime;

  let currentSection = '';
  let output = `gantt
title Trace ${title}
dateFormat x
axisFormat %S.%L
`;

  // Working around unique section names by using non-breaking spaces to keep spans in visual sequence
  const nbsp = ' ';
  let sectionIndex = 0;

  for (const span of sortedSpans) {
    if (isNaN(span.startTime)) {
      throw new Error(`Invalid startTime: ${span.startTime} for spanID: ${span.spanID}`);
    }

    if (span.serviceName !== currentSection) {
      output += `section ${span.serviceName}${nbsp.repeat(sectionIndex)}\n`;
      currentSection = span.serviceName;
      sectionIndex += 1;
    }

    output += formatSpan(span, timeDelta, highlights);
  }

  return output;
}

function formatSpan(span: Span, timeDelta: number, highlights: string[]): string {
  const startTime = Math.round(span.startTime - timeDelta);
  const roundedDuration = Math.max(Math.round(span.duration), 1);
  const isActive = highlights.includes(span.spanID) ? 'active,' : '';

  return `${span.operationName} [${span.duration}ms] :${isActive}${span.spanID},${startTime},${roundedDuration}ms\n`;
}
