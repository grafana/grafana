import saveAs from 'file-saver';
import * as XLSX from 'xlsx';

import {
  type CSVConfig,
  type DataFrame,
  DataTransformerID,
  dateTime,
  dateTimeFormat,
  type LogsModel,
  MutableDataFrame,
  toCSV,
} from '@grafana/data';

import { transformToJaeger } from '../../../plugins/datasource/jaeger/responseTransform';

import { transformToOTLP } from './transformToOTLP';
import { transformToZipkin } from './transformToZipkin';

/**
 * Downloads a DataFrame as a TXT file.
 *
 * @param {(Pick<LogsModel, 'meta' | 'rows'>)} logsModel
 * @param {string} title
 */
export function downloadLogsModelAsTxt(logsModel: Pick<LogsModel, 'meta' | 'rows'>, title = '', fields: string[] = []) {
  let textToDownload = '';

  if (logsModel.meta?.length) {
    logsModel.meta?.forEach((metaItem) => {
      const string = `${metaItem.label ? `${metaItem.label}: ` : ''}${JSON.stringify(metaItem.value)}\n`;
      textToDownload = textToDownload + string;
    });
    textToDownload = textToDownload + '\n\n';
  }

  logsModel.rows.forEach((row) => {
    const entry = !fields.length ? row.entry : fields.map((field) => row.labels[field] ?? '').join(' ');
    const newRow = row.timeEpochMs + '\t' + dateTime(row.timeEpochMs).toISOString() + '\t' + entry + '\n';
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
  transformId: DataTransformerID = DataTransformerID.noop,
  excelCompatibilityMode = false,
  trailingNewline = false
) {
  let blob;
  const newline = trailingNewline ? (csvConfig?.newline ?? '\r\n') : '';

<<<<<<< HEAD
  const blob = new Blob([bomChar, dataFrameCsv], {
    type: 'text/csv;charset=windows-1251;',
  });
=======
  if (excelCompatibilityMode) {
    /**
     * This compatibility mode creates a utf16le csv file that uses \t as the delimiter.
     * This is to fix an issue where excel does not recognize the BOM indicating UTF-8 when the SEP= meta data header is present.
     * Without the SEP= metadata header excel will try to use the system list separator.
     * If the CSV was created on a system where the separator was ',' it will not work on a system where the separator is ';'
     * This is common on locales where ',' is the decimal separator.
     *
     * When excel opens a utf16le csv file it will no longer try to use the system list separator, and instead use \t as the separator.
     */
    const dataFrameCsv = toCSV([dataFrame], { ...csvConfig, useExcelHeader: false, delimiter: '\t' }) + newline;
    const utf16le = new Uint16Array(Array.from('\ufeff' + dataFrameCsv).map((char) => char.charCodeAt(0)));
    blob = new Blob([utf16le], {
      type: 'text/csv;charset=utf-16le',
    });
  } else {
    const dataFrameCsv = toCSV([dataFrame], csvConfig) + newline;
    blob = new Blob([dataFrameCsv], {
      type: 'text/csv;charset=utf-8',
    });
  }
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc

  const transformation = transformId !== DataTransformerID.noop ? '-as-' + transformId.toLocaleLowerCase() : '';
  const fileName = `${title}-data${transformation}-${dateTimeFormat(new Date())}.csv`;
  saveAs(blob, fileName);
}

/**
 * Exports a DataFrame as a XLSX file.
 *
 * @param {DataFrame} dataFrame
 * @param {string} title
 * @param {CSVConfig} [csvConfig]
 * @param {DataTransformerID} [transformId=DataTransformerID.noop]
 */
export function downloadDataFrameAsXlsx(
  dataFrame: DataFrame,
  title: string,
  csvConfig?: CSVConfig,
  transformId: DataTransformerID = DataTransformerID.noop
) {
  const dataFrameCsv = toCSV([dataFrame], csvConfig, true)
    .replaceAll('"', '')
    .replaceAll(/(?<=[0-9])( )(?=[0-9])/g, '');

  const rows = dataFrameCsv.split('\r\n').map((row, rowIndex) => {
    const columns = row.split(';');
    return columns.map((col) => {
      // Преобразуем в число, если это возможно
      const num = Number(col.replaceAll(/(?<=[0-9]),(?=[0-9])/g, '.'));
      return isNaN(num) ? String(col) : num; // Если не число, возвращаем оригинальное значение
    });
  });

  // Создаем рабочую книгу и лист
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  // Добавляем лист в рабочую книгу
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const transformation = transformId !== DataTransformerID.noop ? '-as-' + transformId.toLocaleLowerCase() : '';
  const fileName = `${title}-data${transformation}-${dateTimeFormat(new Date())}.xlsx`;

  // Сохраняем рабочую книгу в файл
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
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
