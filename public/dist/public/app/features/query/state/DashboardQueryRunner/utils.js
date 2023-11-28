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
export const emptyResult = () => of({ annotations: [], alertStates: [] });
export function handleDashboardQueryRunnerWorkerError(err) {
    if (err.cancelled) {
        return emptyResult();
    }
    notifyWithError('DashboardQueryRunner failed', err);
    return emptyResult();
}
function notifyWithError(title, err) {
    const error = toDataQueryError(err);
    console.error('handleAnnotationQueryRunnerError', error);
    const notification = createErrorNotification(title, error.message);
    dispatch(notifyApp(notification));
}
export function getAnnotationsByPanelId(annotations, panelId) {
    if (panelId == null) {
        return annotations;
    }
    return annotations.filter((item) => {
        var _a;
        let source;
        source = item.source;
        if (!source) {
            return true; // should not happen
        }
        // generic panel filtering
        if (source.filter) {
            const includes = ((_a = source.filter.ids) !== null && _a !== void 0 ? _a : []).includes(panelId);
            if (source.filter.exclude) {
                if (includes) {
                    return false;
                }
            }
            else if (!includes) {
                return false;
            }
        }
        // this is valid for the main 'grafana' datasource
        if (item.panelId && item.source.type === 'dashboard') {
            return item.panelId === panelId;
        }
        return true;
    });
}
export function translateQueryResult(annotation, results) {
    var _a;
    // if annotation has snapshotData
    // make clone and remove it
    if (annotation.snapshotData) {
        annotation = cloneDeep(annotation);
        delete annotation.snapshotData;
    }
    for (const item of results) {
        item.source = annotation;
        item.color = config.theme2.visualization.getColorByName(annotation.iconColor);
        item.type = annotation.name;
        item.isRegion = Boolean(item.timeEnd && item.time !== item.timeEnd);
        switch ((_a = item.newState) === null || _a === void 0 ? void 0 : _a.toLowerCase()) {
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
    return results;
}
export function annotationsFromDataFrames(data) {
    if (!data || !data.length) {
        return [];
    }
    const annotations = [];
    for (const frame of data) {
        const view = new DataFrameView(frame);
        for (let index = 0; index < frame.length; index++) {
            const annotation = cloneDeep(view.get(index));
            annotations.push(annotation);
        }
    }
    return annotations;
}
//# sourceMappingURL=utils.js.map