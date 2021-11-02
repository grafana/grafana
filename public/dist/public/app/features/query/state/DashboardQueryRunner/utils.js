import { __values } from "tslib";
import { cloneDeep } from 'lodash';
import { of } from 'rxjs';
import { DataFrameView } from '@grafana/data';
import { config, toDataQueryError } from '@grafana/runtime';
import { dispatch } from 'app/store/store';
import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
export function handleAnnotationQueryRunnerError(err) {
    if (err.cancelled) {
        return of([]);
    }
    notifyWithError('AnnotationQueryRunner failed', err);
    return of([]);
}
export function handleDatasourceSrvError(err) {
    notifyWithError('Failed to retrieve datasource', err);
    return of(undefined);
}
export var emptyResult = function () {
    return of({ annotations: [], alertStates: [] });
};
export function handleDashboardQueryRunnerWorkerError(err) {
    if (err.cancelled) {
        return emptyResult();
    }
    notifyWithError('DashboardQueryRunner failed', err);
    return emptyResult();
}
function notifyWithError(title, err) {
    var error = toDataQueryError(err);
    console.error('handleAnnotationQueryRunnerError', error);
    var notification = createErrorNotification(title, error.message);
    dispatch(notifyApp(notification));
}
export function getAnnotationsByPanelId(annotations, panelId) {
    return annotations.filter(function (item) {
        var _a;
        if (panelId !== undefined && item.panelId && ((_a = item.source) === null || _a === void 0 ? void 0 : _a.type) === 'dashboard') {
            return item.panelId === panelId;
        }
        return true;
    });
}
export function translateQueryResult(annotation, results) {
    var e_1, _a;
    var _b;
    // if annotation has snapshotData
    // make clone and remove it
    if (annotation.snapshotData) {
        annotation = cloneDeep(annotation);
        delete annotation.snapshotData;
    }
    try {
        for (var results_1 = __values(results), results_1_1 = results_1.next(); !results_1_1.done; results_1_1 = results_1.next()) {
            var item = results_1_1.value;
            item.source = annotation;
            item.color = config.theme2.visualization.getColorByName(annotation.iconColor);
            item.type = annotation.name;
            item.isRegion = Boolean(item.timeEnd && item.time !== item.timeEnd);
            switch ((_b = item.newState) === null || _b === void 0 ? void 0 : _b.toLowerCase()) {
                case 'pending':
                    item.color = 'yellow';
                    break;
                case 'alerting':
                    item.color = 'red';
                    break;
                case 'ok':
                    item.color = 'green';
                    break;
                case 'normal': // ngalert ("normal" instead of "ok")
                    item.color = 'green';
                    break;
                case 'no_data':
                    item.color = 'gray';
                    break;
                case 'nodata': // ngalert
                    item.color = 'gray';
                    break;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (results_1_1 && !results_1_1.done && (_a = results_1.return)) _a.call(results_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return results;
}
export function annotationsFromDataFrames(data) {
    var e_2, _a;
    if (!data || !data.length) {
        return [];
    }
    var annotations = [];
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var frame = data_1_1.value;
            var view = new DataFrameView(frame);
            for (var index = 0; index < frame.length; index++) {
                var annotation = cloneDeep(view.get(index));
                annotations.push(annotation);
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return annotations;
}
//# sourceMappingURL=utils.js.map