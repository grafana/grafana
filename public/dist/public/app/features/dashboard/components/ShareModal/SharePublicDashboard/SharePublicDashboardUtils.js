import { __awaiter } from "tslib";
import { DataSourceWithBackend } from '@grafana/runtime';
import { getConfig } from 'app/core/config';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { shareDashboardType } from '../utils';
import { supportedDatasources } from './SupportedPubdashDatasources';
export var PublicDashboardShareType;
(function (PublicDashboardShareType) {
    PublicDashboardShareType["PUBLIC"] = "public";
    PublicDashboardShareType["EMAIL"] = "email";
})(PublicDashboardShareType || (PublicDashboardShareType = {}));
// Instance methods
export const dashboardHasTemplateVariables = (variables) => {
    return variables.length > 0;
};
export const publicDashboardPersisted = (publicDashboard) => {
    return (publicDashboard === null || publicDashboard === void 0 ? void 0 : publicDashboard.uid) !== '' && (publicDashboard === null || publicDashboard === void 0 ? void 0 : publicDashboard.uid) !== undefined;
};
/**
 * Get unique datasource names from all panels that are not currently supported by public dashboards.
 */
export const getUnsupportedDashboardDatasources = (panels) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    let unsupportedDS = new Set();
    for (const panel of panels) {
        for (const target of panel.targets) {
            const dsType = (_a = target === null || target === void 0 ? void 0 : target.datasource) === null || _a === void 0 ? void 0 : _a.type;
            if (dsType) {
                if (!supportedDatasources.has(dsType)) {
                    unsupportedDS.add(dsType);
                }
                else {
                    const ds = yield getDatasourceSrv().get(target.datasource);
                    if (!(ds instanceof DataSourceWithBackend)) {
                        unsupportedDS.add(dsType);
                    }
                }
            }
        }
    }
    return Array.from(unsupportedDS).sort();
});
/**
 * Generate the public dashboard url. Uses the appUrl from the Grafana boot config, so urls will also be correct
 * when Grafana is hosted on a subpath.
 *
 * All app urls from the Grafana boot config end with a slash.
 *
 * @param accessToken
 */
export const generatePublicDashboardUrl = (accessToken) => {
    return `${getConfig().appUrl}public-dashboards/${accessToken}`;
};
export const generatePublicDashboardConfigUrl = (dashboardUid) => {
    return `/d/${dashboardUid}?shareView=${shareDashboardType.publicDashboard}`;
};
export const validEmailRegex = /^[A-Z\d._%+-]+@[A-Z\d.-]+\.[A-Z]{2,}$/i;
//# sourceMappingURL=SharePublicDashboardUtils.js.map