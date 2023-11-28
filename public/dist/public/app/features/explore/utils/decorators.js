import { groupBy, mapValues } from 'lodash';
import { of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { FieldType, getDisplayProcessor, standardTransformers, preProcessPanelData, DataLinkConfigOrigin, getRawDisplayProcessor, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { refreshIntervalToSortOrder } from '../../../core/utils/explore';
import { attachCorrelationsToDataFrames } from '../../correlations/utils';
import { dataFrameToLogsModel } from '../../logs/logsModel';
import { sortLogsResult } from '../../logs/utils';
import { hasPanelPlugin } from '../../plugins/importPanelPlugin';
/**
 * When processing response first we try to determine what kind of dataframes we got as one query can return multiple
 * dataFrames with different type of data. This is later used for type specific processing. As we use this in
 * Observable pipeline, it decorates the existing panelData to pass the results to later processing stages.
 */
export const decorateWithFrameTypeMetadata = (data) => {
    var _a;
    const graphFrames = [];
    const tableFrames = [];
    const rawPrometheusFrames = [];
    const logsFrames = [];
    const traceFrames = [];
    const nodeGraphFrames = [];
    const flameGraphFrames = [];
    const customFrames = [];
    for (const frame of data.series) {
        if (canFindPanel(frame)) {
            customFrames.push(frame);
            continue;
        }
        switch ((_a = frame.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) {
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
                }
                else {
                    // We fallback to table if we do not have any better meta info about the dataframe.
                    tableFrames.push(frame);
                }
        }
    }
    return Object.assign(Object.assign({}, data), { graphFrames,
        tableFrames,
        logsFrames,
        traceFrames,
        nodeGraphFrames,
        customFrames,
        flameGraphFrames,
        rawPrometheusFrames, graphResult: null, tableResult: null, logsResult: null, rawPrometheusResult: null });
};
export const decorateWithCorrelations = ({ showCorrelationEditorLinks, queries, correlations, defaultTargetDatasource, }) => {
    return (data) => {
        if (showCorrelationEditorLinks && defaultTargetDatasource) {
            for (const frame of data.series) {
                for (const field of frame.fields) {
                    field.config.links = []; // hide all previous links, we only want to show fake correlations in this view
                    field.display = field.display || getRawDisplayProcessor();
                    const availableVars = {};
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
                            meta: {
                                correlationData: { resultField: field.name, vars: availableVars },
                            },
                        },
                    });
                }
            }
        }
        else if ((queries === null || queries === void 0 ? void 0 : queries.length) && (correlations === null || correlations === void 0 ? void 0 : correlations.length)) {
            const queryRefIdToDataSourceUid = mapValues(groupBy(queries, 'refId'), '0.datasource.uid');
            attachCorrelationsToDataFrames(data.series, correlations, queryRefIdToDataSourceUid);
        }
        return data;
    };
};
export const decorateWithGraphResult = (data) => {
    if (!data.graphFrames.length) {
        return Object.assign(Object.assign({}, data), { graphResult: null });
    }
    return Object.assign(Object.assign({}, data), { graphResult: data.graphFrames });
};
/**
 * This processing returns Observable because it uses Transformer internally which result type is also Observable.
 * In this case the transformer should return single result, but it is possible that in the future it could return
 * multiple results and so this should be used with mergeMap or similar to unbox the internal observable.
 */
export const decorateWithTableResult = (data) => {
    if (data.tableFrames.length === 0) {
        return of(Object.assign(Object.assign({}, data), { tableResult: null }));
    }
    data.tableFrames.sort((frameA, frameB) => {
        const frameARefId = frameA.refId;
        const frameBRefId = frameB.refId;
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
        interpolate: (v) => v,
    };
    // If we have only timeseries we do join on default time column which makes more sense. If we are showing
    // non timeseries or some mix of data we are not trying to join on anything and just try to merge them in
    // single table, which may not make sense in most cases, but it's up to the user to query something sensible.
    const transformer = hasOnlyTimeseries
        ? of(data.tableFrames).pipe(standardTransformers.joinByFieldTransformer.operator({}, transformContext))
        : of(data.tableFrames).pipe(standardTransformers.mergeTransformer.operator({}, transformContext));
    return transformer.pipe(map((frames) => {
        var _a, _b, _c;
        for (const frame of frames) {
            // set display processor
            for (const field of frame.fields) {
                field.display =
                    (_a = field.display) !== null && _a !== void 0 ? _a : getDisplayProcessor({
                        field,
                        theme: config.theme2,
                        timeZone: (_c = (_b = data.request) === null || _b === void 0 ? void 0 : _b.timezone) !== null && _c !== void 0 ? _c : 'browser',
                    });
            }
        }
        return Object.assign(Object.assign({}, data), { tableResult: frames });
    }));
};
export const decorateWithRawPrometheusResult = (data) => {
    // Prometheus has a custom frame visualization alongside the table view, but they both handle the data the same
    const tableFrames = data.rawPrometheusFrames;
    if (!tableFrames || tableFrames.length === 0) {
        return of(Object.assign(Object.assign({}, data), { tableResult: null }));
    }
    tableFrames.sort((frameA, frameB) => {
        const frameARefId = frameA.refId;
        const frameBRefId = frameB.refId;
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
        interpolate: (v) => v,
    };
    // If we have only timeseries we do join on default time column which makes more sense. If we are showing
    // non timeseries or some mix of data we are not trying to join on anything and just try to merge them in
    // single table, which may not make sense in most cases, but it's up to the user to query something sensible.
    const transformer = hasOnlyTimeseries
        ? of(tableFrames).pipe(standardTransformers.joinByFieldTransformer.operator({}, transformContext))
        : of(tableFrames).pipe(standardTransformers.mergeTransformer.operator({}, transformContext));
    return transformer.pipe(map((frames) => {
        var _a, _b, _c;
        const frame = frames[0];
        // set display processor
        for (const field of frame.fields) {
            field.display =
                (_a = field.display) !== null && _a !== void 0 ? _a : getDisplayProcessor({
                    field,
                    theme: config.theme2,
                    timeZone: (_c = (_b = data.request) === null || _b === void 0 ? void 0 : _b.timezone) !== null && _c !== void 0 ? _c : 'browser',
                });
        }
        return Object.assign(Object.assign({}, data), { rawPrometheusResult: frame });
    }));
};
export const decorateWithLogsResult = (options = {}) => (data) => {
    var _a;
    if (data.logsFrames.length === 0) {
        return Object.assign(Object.assign({}, data), { logsResult: null });
    }
    const intervalMs = (_a = data.request) === null || _a === void 0 ? void 0 : _a.intervalMs;
    const newResults = dataFrameToLogsModel(data.logsFrames, intervalMs, options.absoluteRange, options.queries);
    const sortOrder = refreshIntervalToSortOrder(options.refreshInterval);
    const sortedNewResults = sortLogsResult(newResults, sortOrder);
    const rows = sortedNewResults.rows;
    const series = sortedNewResults.series;
    const logsResult = Object.assign(Object.assign({}, sortedNewResults), { rows, series });
    return Object.assign(Object.assign({}, data), { logsResult });
};
// decorateData applies all decorators
export function decorateData(data, queryResponse, absoluteRange, refreshInterval, queries, correlations, showCorrelationEditorLinks, defaultCorrelationTargetDatasource) {
    return of(data).pipe(map((data) => preProcessPanelData(data, queryResponse)), map(decorateWithCorrelations({
        defaultTargetDatasource: defaultCorrelationTargetDatasource,
        showCorrelationEditorLinks,
        queries,
        correlations,
    })), map(decorateWithFrameTypeMetadata), map(decorateWithGraphResult), map(decorateWithLogsResult({ absoluteRange, refreshInterval, queries })), mergeMap(decorateWithRawPrometheusResult), mergeMap(decorateWithTableResult));
}
/**
 * Check if frame contains time series, which for our purpose means 1 time column and 1 or more numeric columns.
 */
function isTimeSeries(frame) {
    var _a;
    const grouped = groupBy(frame.fields, (field) => field.type);
    return Boolean(Object.keys(grouped).length === 2 && ((_a = grouped[FieldType.time]) === null || _a === void 0 ? void 0 : _a.length) === 1 && grouped[FieldType.number]);
}
/**
 * Can we find a panel that matches the type defined on the frame
 *
 * @param frame
 */
function canFindPanel(frame) {
    var _a, _b;
    if (!!((_a = frame.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationPluginId)) {
        return hasPanelPlugin((_b = frame.meta) === null || _b === void 0 ? void 0 : _b.preferredVisualisationPluginId);
    }
    return false;
}
//# sourceMappingURL=decorators.js.map