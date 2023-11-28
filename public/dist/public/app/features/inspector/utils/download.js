import saveAs from 'file-saver';
import { DataTransformerID, dateTimeFormat, MutableDataFrame, toCSV, } from '@grafana/data';
import { transformToJaeger } from '../../../plugins/datasource/jaeger/responseTransform';
import { transformToOTLP } from '../../../plugins/datasource/tempo/resultTransformer';
import { transformToZipkin } from '../../../plugins/datasource/zipkin/utils/transforms';
/**
 * Downloads a DataFrame as a TXT file.
 *
 * @param {(Pick<LogsModel, 'meta' | 'rows'>)} logsModel
 * @param {string} title
 */
export function downloadLogsModelAsTxt(logsModel, title) {
    var _a;
    let textToDownload = '';
    (_a = logsModel.meta) === null || _a === void 0 ? void 0 : _a.forEach((metaItem) => {
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
export function downloadDataFrameAsCsv(dataFrame, title, csvConfig, transformId = DataTransformerID.noop) {
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
 * @param {unknown} json
 * @param {string} title
 */
export function downloadAsJson(json, title) {
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
export function downloadTraceAsJson(frame, title) {
    var _a, _b;
    let traceFormat = 'otlp';
    switch ((_b = (_a = frame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.traceFormat) {
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
//# sourceMappingURL=download.js.map