import { __awaiter } from "tslib";
import { Observable } from 'rxjs';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { getCorrelationsBySourceUIDs, createCorrelation } from 'app/features/correlations/utils';
import { store } from 'app/store/store';
import { saveCorrelationsAction } from './explorePane';
import { splitClose } from './main';
import { runQueries } from './query';
/**
 * Creates an observable that emits correlations once they are loaded
 */
export const getCorrelations = (exploreId) => {
    return new Observable((subscriber) => {
        var _a;
        const existingCorrelations = (_a = store.getState().explore.panes[exploreId]) === null || _a === void 0 ? void 0 : _a.correlations;
        if (existingCorrelations) {
            subscriber.next(existingCorrelations);
            subscriber.complete();
        }
        else {
            const unsubscribe = store.subscribe(() => {
                var _a;
                const correlations = (_a = store.getState().explore.panes[exploreId]) === null || _a === void 0 ? void 0 : _a.correlations;
                if (correlations) {
                    unsubscribe();
                    subscriber.next(correlations);
                    subscriber.complete();
                }
            });
        }
    });
};
function reloadCorrelations(exploreId) {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const pane = getState().explore.panes[exploreId];
        if (((_a = pane.datasourceInstance) === null || _a === void 0 ? void 0 : _a.uid) !== undefined) {
            // TODO: Tie correlations with query refID for mixed datasource
            let datasourceUIDs = pane.datasourceInstance.meta.mixed
                ? pane.queries.map((query) => { var _a; return (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.uid; }).filter((x) => x !== null)
                : [pane.datasourceInstance.uid];
            const correlations = yield getCorrelationsBySourceUIDs(datasourceUIDs);
            dispatch(saveCorrelationsAction({ exploreId, correlations: correlations.correlations || [] }));
        }
    });
}
export function saveCurrentCorrelation(label, description) {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const keys = Object.keys((_a = getState().explore) === null || _a === void 0 ? void 0 : _a.panes);
        const sourcePane = (_b = getState().explore) === null || _b === void 0 ? void 0 : _b.panes[keys[0]];
        const targetPane = (_c = getState().explore) === null || _c === void 0 ? void 0 : _c.panes[keys[1]];
        if (!sourcePane || !targetPane) {
            return;
        }
        const sourceDatasourceRef = ((_d = sourcePane.datasourceInstance) === null || _d === void 0 ? void 0 : _d.meta.mixed)
            ? sourcePane.queries[0].datasource
            : (_e = sourcePane.datasourceInstance) === null || _e === void 0 ? void 0 : _e.getRef();
        const targetDataSourceRef = ((_f = targetPane.datasourceInstance) === null || _f === void 0 ? void 0 : _f.meta.mixed)
            ? targetPane.queries[0].datasource
            : (_g = targetPane.datasourceInstance) === null || _g === void 0 ? void 0 : _g.getRef();
        const [sourceDatasource, targetDatasource] = yield Promise.all([
            getDataSourceSrv().get(sourceDatasourceRef),
            getDataSourceSrv().get(targetDataSourceRef),
        ]);
        if ((sourceDatasource === null || sourceDatasource === void 0 ? void 0 : sourceDatasource.uid) && (targetDatasource === null || targetDatasource === void 0 ? void 0 : targetDatasource.uid) && ((_h = targetPane.correlationEditorHelperData) === null || _h === void 0 ? void 0 : _h.resultField)) {
            const correlation = {
                sourceUID: sourceDatasource.uid,
                targetUID: targetDatasource.uid,
                label: label || `${sourceDatasource === null || sourceDatasource === void 0 ? void 0 : sourceDatasource.name} to ${targetDatasource.name}`,
                description,
                config: {
                    field: targetPane.correlationEditorHelperData.resultField,
                    target: targetPane.queries[0],
                    type: 'query',
                },
            };
            yield createCorrelation(sourceDatasource.uid, correlation)
                .then(() => __awaiter(this, void 0, void 0, function* () {
                dispatch(splitClose(keys[1]));
                yield dispatch(reloadCorrelations(keys[0]));
                yield dispatch(runQueries({ exploreId: keys[0] }));
                reportInteraction('grafana_explore_correlation_editor_saved', {
                    sourceDatasourceType: sourceDatasource.type,
                    targetDataSourceType: targetDatasource.type,
                });
            }))
                .catch((err) => {
                dispatch(notifyApp(createErrorNotification('Error creating correlation', err)));
                console.error(err);
            });
        }
    });
}
//# sourceMappingURL=correlations.js.map