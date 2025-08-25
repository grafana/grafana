import saveAs from 'file-saver';

import {
  CSVConfig,
  DataFrame,
  DataTransformerID,
  dateTime,
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
export function downloadLogsModelAsTxt(logsModel: Pick<LogsModel, 'meta' | 'rows'>, title = '') {
  let textToDownload = '';

  logsModel.meta?.forEach((metaItem) => {
    const string = `${metaItem.label}: ${JSON.stringify(metaItem.value)}\n`;
    textToDownload = textToDownload + string;
  });
  textToDownload = textToDownload + '\n\n';

  logsModel.rows.forEach((row) => {
    const newRow = row.timeEpochMs + '\t' + dateTime(row.timeEpochMs).toISOString() + '\t' + row.entry + '\n';
    textToDownload = textToDownload + newRow;
  });

  const blob = new Blob([textToDownload], {
    type: 'text/plain;charset=utf-8',
  });
  const fileName = `${title ? `${title}-logs` : 'Logs'}-${dateTimeFormat(new Date())}.txt`;
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
  let blob;

  if (csvConfig?.useExcelHeader) {
    const dataFrameCsv = toCSV([dataFrame], { ...csvConfig, useExcelHeader: false, delimiter: '\t' });
    const utf16le = new Uint16Array(Array.from('\ufeff' + dataFrameCsv).map((char) => char.charCodeAt(0)));
    blob = new Blob([utf16le], {
      type: 'text/csv;charset=utf-16le',
    });
  } else {
    const dataFrameCsv = toCSV([dataFrame], csvConfig);
    blob = new Blob([dataFrameCsv], {
      type: 'text/csv;charset=utf-8',
    });
  }

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
