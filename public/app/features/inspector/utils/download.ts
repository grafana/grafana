import saveAs from 'file-saver';

import { CSVConfig, DataFrame, DataTransformerID, dateTimeFormat, dateTimeFormatISO, toCSV } from '@grafana/data';
import { dataFrameToLogsModel } from 'app/core/logsModel';

/**
 * Downloads a DataFrame as a TXT file.
 *
 * @param {DataFrame[]} data
 * @param {string} title
 */
export function downloadDataFrameAsTxt(data: DataFrame[], title: string) {
  const logsModel = dataFrameToLogsModel(data || [], undefined);
  let textToDownload = '';

  logsModel.meta?.forEach((metaItem) => {
    const string = `${metaItem.label}: ${JSON.stringify(metaItem.value)}\n`;
    textToDownload = textToDownload + string;
  });
  textToDownload = textToDownload + '\n\n';

  logsModel.rows.forEach((row) => {
    const newRow = dateTimeFormatISO(row.timeEpochMs) + '\t' + row.entry + '\n';
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
 * @export
 * @param {DataFrame} dataFrame
 * @param {CSVConfig} csvConfig
 * @param {string} title
 * @param {DataTransformerID} [transformId=DataTransformerID.noop]
 */
export function downloadDataFrameAsCsv(
  dataFrame: DataFrame,
  csvConfig: CSVConfig,
  title: string,
  transformId: DataTransformerID = DataTransformerID.noop
) {
  const dataFrameCsv = toCSV([dataFrame], csvConfig);

  const blob = new Blob([String.fromCharCode(0xfeff), dataFrameCsv], {
    type: 'text/csv;charset=utf-8',
  });

  const transformation = transformId !== DataTransformerID.noop ? '-as-' + transformId.toLocaleLowerCase() : '';
  const fileName = `${title}-data${transformation}-${dateTimeFormat(new Date())}.csv`;
  saveAs(blob, fileName);
}

/**
 * Downloads any object as JSON file.
 *
 * @export
 * @param {*} json
 * @param {string} title
 */
export function downloadAsJson(json: any, title: string) {
  const blob = new Blob([JSON.stringify(json)], {
    type: 'application/json',
  });

  const fileName = `${title}-traces-${dateTimeFormat(new Date())}.json`;
  saveAs(blob, fileName);
}
