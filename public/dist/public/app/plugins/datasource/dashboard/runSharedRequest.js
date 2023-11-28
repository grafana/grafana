import { Observable } from 'rxjs';
import { getDefaultTimeRange, LoadingState, DataTopic, } from '@grafana/data';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { SHARED_DASHBOARD_QUERY } from './types';
export function isSharedDashboardQuery(datasource) {
    if (!datasource) {
        // default datasource
        return false;
    }
    if (typeof datasource === 'string') {
        return datasource === SHARED_DASHBOARD_QUERY;
    }
    if ('meta' in datasource) {
        return datasource.meta.name === SHARED_DASHBOARD_QUERY || datasource.uid === SHARED_DASHBOARD_QUERY;
    }
    return datasource.uid === SHARED_DASHBOARD_QUERY;
}
export function runSharedRequest(options, query) {
    return new Observable((subscriber) => {
        const dashboard = getDashboardSrv().getCurrent();
        const listenToPanelId = getPanelIdFromQuery(options.queries);
        if (!listenToPanelId) {
            subscriber.next(getQueryError('Missing panel reference ID'));
            return undefined;
        }
        const listenToPanel = dashboard === null || dashboard === void 0 ? void 0 : dashboard.getPanelById(listenToPanelId);
        if (!listenToPanel) {
            subscriber.next(getQueryError('Unknown Panel: ' + listenToPanelId));
            return undefined;
        }
        const listenToRunner = listenToPanel.getQueryRunner();
        const subscription = listenToRunner
            .getData({
            withTransforms: Boolean(query === null || query === void 0 ? void 0 : query.withTransforms),
            withFieldConfig: false,
        })
            .subscribe({
            next: (data) => {
                var _a;
                // Use annotation data for series
                if ((query === null || query === void 0 ? void 0 : query.topic) === DataTopic.Annotations) {
                    data = Object.assign(Object.assign({}, data), { series: (_a = data.annotations) !== null && _a !== void 0 ? _a : [], annotations: undefined });
                }
                subscriber.next(data);
            },
        });
        // If we are in fullscreen the other panel will not execute any queries
        // So we have to trigger it from here
        if (!listenToPanel.isInView) {
            const { datasource, targets } = listenToPanel;
            const modified = Object.assign(Object.assign({}, options), { datasource, panelId: listenToPanelId, queries: targets });
            listenToRunner.run(modified);
        }
        return () => {
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