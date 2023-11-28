import { useLocation } from 'react-router-dom';
import { urlUtil } from '@grafana/data';
import { locationSearchToObject } from '@grafana/runtime';
import { QueryVariable, SceneQueryRunner, SceneVariableSet } from '@grafana/scenes';
export function useAppQueryParams() {
    const location = useLocation();
    return locationSearchToObject(location.search || '');
}
export function getLinkUrlWithAppUrlState(path, params) {
    return urlUtil.renderUrl(path, params);
}
export function getInstantQuery(query) {
    return new SceneQueryRunner({
        datasource: { uid: 'gdev-prometheus' },
        queries: [
            Object.assign({ refId: 'A', instant: true, format: 'table', maxDataPoints: 500 }, query),
        ],
    });
}
export function getTimeSeriesQuery(query) {
    return new SceneQueryRunner({
        datasource: { uid: 'gdev-prometheus' },
        queries: [
            Object.assign({ refId: 'A', range: true, format: 'time_series', maxDataPoints: 500 }, query),
        ],
    });
}
export function getVariablesDefinitions() {
    return new SceneVariableSet({
        variables: [
            new QueryVariable({
                name: 'instance',
                datasource: { uid: 'gdev-prometheus' },
                query: { query: 'label_values(grafana_http_request_duration_seconds_sum, instance)', refId: 'A' },
            }),
        ],
    });
}
//# sourceMappingURL=utils.js.map