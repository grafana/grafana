import { config } from '@grafana/runtime';
export function newBrowseDashboardsEnabled() {
    return config.featureToggles.nestedFolders || config.featureToggles.newBrowseDashboards;
}
//# sourceMappingURL=featureFlag.js.map