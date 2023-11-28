import { reportInteraction } from '@grafana/runtime';
export function trackDashboardLoaded(dashboard, versionBeforeMigration) {
    // Count the different types of variables
    const variables = dashboard.templating.list
        .map((v) => v.type)
        .reduce((r, k) => {
        r[variableName(k)] = 1 + r[variableName(k)] || 1;
        return r;
    }, {});
    reportInteraction('dashboards_init_dashboard_completed', Object.assign({ uid: dashboard.uid, title: dashboard.title, theme: dashboard.style, schemaVersion: dashboard.schemaVersion, version_before_migration: versionBeforeMigration, panels_count: dashboard.panels.length }, variables));
}
const variableName = (type) => `variable_type_${type}_count`;
//# sourceMappingURL=tracking.js.map