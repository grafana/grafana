import { sharedSingleStatPanelChangedHandler, sharedSingleStatMigrationHandler } from '@grafana/ui';
// This is called when the panel first loads
export const gaugePanelMigrationHandler = (panel) => {
    return sharedSingleStatMigrationHandler(panel);
};
// This is called when the panel changes from another panel
export const gaugePanelChangedHandler = (panel, prevPluginId, prevOptions) => {
    // This handles most config changes
    const opts = sharedSingleStatPanelChangedHandler(panel, prevPluginId, prevOptions);
    // Changing from angular singlestat
    if (prevPluginId === 'singlestat' && prevOptions.angular) {
        const gauge = prevOptions.angular.gauge;
        if (gauge) {
            opts.showThresholdMarkers = gauge.thresholdMarkers;
            opts.showThresholdLabels = gauge.thresholdLabels;
        }
    }
    return opts;
};
//# sourceMappingURL=GaugeMigrations.js.map