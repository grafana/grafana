import { __assign } from "tslib";
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { config } from 'app/core/config';
import { isGrafanaAdmin } from 'app/features/plugins/admin/permissions';
var liveRoutes = [
    {
        path: '/live',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "LiveStatusPage" */ 'app/features/live/pages/LiveStatusPage'); }),
    },
    {
        path: '/live/pipeline',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PipelineAdminPage" */ 'app/features/live/pages/PipelineAdminPage'); }),
    },
    {
        path: '/live/cloud',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "CloudAdminPage" */ 'app/features/live/pages/CloudAdminPage'); }),
    },
];
export function getLiveRoutes(cfg) {
    if (cfg === void 0) { cfg = config; }
    if (!isGrafanaAdmin()) {
        return [];
    }
    if (cfg.featureToggles['live-pipeline']) {
        return liveRoutes;
    }
    return liveRoutes.map(function (v) { return (__assign(__assign({}, v), { component: SafeDynamicImport(function () { return import(/* webpackChunkName: "FeatureTogglePage" */ 'app/features/live/pages/FeatureTogglePage'); }) })); });
}
//# sourceMappingURL=routes.js.map