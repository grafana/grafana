import { config } from '@grafana/runtime';
import { SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { ShareQueryDataProvider } from '../scene/ShareQueryDataProvider';
export function createPanelDataProvider(panel) {
    var _a, _b, _c, _d, _e, _f;
    // Skip setting query runner for panels without queries
    if (!((_a = panel.targets) === null || _a === void 0 ? void 0 : _a.length)) {
        return undefined;
    }
    // Skip setting query runner for panel plugins with skipDataQuery
    if ((_b = config.panels[panel.type]) === null || _b === void 0 ? void 0 : _b.skipDataQuery) {
        return undefined;
    }
    let dataProvider = undefined;
    if (((_c = panel.datasource) === null || _c === void 0 ? void 0 : _c.uid) === SHARED_DASHBOARD_QUERY) {
        dataProvider = new ShareQueryDataProvider({ query: panel.targets[0] });
    }
    else {
        dataProvider = new SceneQueryRunner({
            datasource: (_d = panel.datasource) !== null && _d !== void 0 ? _d : undefined,
            queries: panel.targets,
            maxDataPoints: (_e = panel.maxDataPoints) !== null && _e !== void 0 ? _e : undefined,
            maxDataPointsFromWidth: true,
            dataLayerFilter: {
                panelId: panel.id,
            },
        });
    }
    // Wrap inner data provider in a data transformer
    if ((_f = panel.transformations) === null || _f === void 0 ? void 0 : _f.length) {
        dataProvider = new SceneDataTransformer({
            $data: dataProvider,
            transformations: panel.transformations,
        });
    }
    return dataProvider;
}
//# sourceMappingURL=createPanelDataProvider.js.map