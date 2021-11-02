import { __assign } from "tslib";
import { Observable } from 'rxjs';
import { SHARED_DASHBODARD_QUERY } from './types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getDefaultTimeRange, LoadingState, } from '@grafana/data';
export function isSharedDashboardQuery(datasource) {
    var _a;
    if (!datasource) {
        // default datasource
        return false;
    }
    if (datasource === SHARED_DASHBODARD_QUERY || ((_a = datasource) === null || _a === void 0 ? void 0 : _a.uid) === SHARED_DASHBODARD_QUERY) {
        return true;
    }
    var ds = datasource;
    return ds.meta && ds.meta.name === SHARED_DASHBODARD_QUERY;
}
export function runSharedRequest(options) {
    return new Observable(function (subscriber) {
        var dashboard = getDashboardSrv().getCurrent();
        var listenToPanelId = getPanelIdFromQuery(options.queries);
        if (!listenToPanelId) {
            subscriber.next(getQueryError('Missing panel reference ID'));
            return undefined;
        }
        var listenToPanel = dashboard === null || dashboard === void 0 ? void 0 : dashboard.getPanelById(listenToPanelId);
        if (!listenToPanel) {
            subscriber.next(getQueryError('Unknown Panel: ' + listenToPanelId));
            return undefined;
        }
        var listenToRunner = listenToPanel.getQueryRunner();
        var subscription = listenToRunner.getData({ withTransforms: false, withFieldConfig: false }).subscribe({
            next: function (data) {
                subscriber.next(data);
            },
        });
        // If we are in fullscreen the other panel will not execute any queries
        // So we have to trigger it from here
        if (!listenToPanel.isInView) {
            var datasource = listenToPanel.datasource, targets = listenToPanel.targets;
            var modified = __assign(__assign({}, options), { datasource: datasource, panelId: listenToPanelId, queries: targets });
            listenToRunner.run(modified);
        }
        return function () {
            subscription.unsubscribe();
        };
    });
}
function getPanelIdFromQuery(queries) {
    if (!queries || !queries.length) {
        return undefined;
    }
    return queries[0].panelId;
}
function getQueryError(msg) {
    return {
        state: LoadingState.Error,
        series: [],
        request: {},
        error: { message: msg },
        timeRange: getDefaultTimeRange(),
    };
}
//# sourceMappingURL=runSharedRequest.js.map