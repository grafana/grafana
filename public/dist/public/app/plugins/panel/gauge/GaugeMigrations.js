import { sharedSingleStatPanelChangedHandler, sharedSingleStatMigrationHandler } from '@grafana/ui';
// This is called when the panel first loads
export var gaugePanelMigrationHandler = function (panel) {
    return sharedSingleStatMigrationHandler(panel);
};
// This is called when the panel changes from another panel
export var gaugePanelChangedHandler = function (panel, prevPluginId, prevOptions) {
    // This handles most config changes
    var opts = sharedSingleStatPanelChangedHandler(panel, prevPluginId, prevOptions);
    // Changing from angular singlestat
    if (prevPluginId === 'singlestat' && prevOptions.angular) {
        var gauge = prevOptions.angular.gauge;
        if (gauge) {
            opts.showThresholdMarkers = gauge.thresholdMarkers;
            opts.showThresholdLabels = gauge.thresholdLabels;
        }
    }
    return opts;
};
//# sourceMappingURL=GaugeMigrations.js.map